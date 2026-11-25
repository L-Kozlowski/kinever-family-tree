"""SQLite repository. Each write is an atomic, optimistic-lock transaction."""
from contextlib import contextmanager
import json
import sqlite3
from pathlib import Path
from typing import Any, Iterator
from backend.deletion import validate_deletions


class Conflict(Exception):
    pass


class Store:
    def __init__(self, root: Path) -> None:
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        (root / 'media').mkdir(exist_ok=True)
        self.db = root / 'genealogy.sqlite3'
        with self.connect() as db:
            if db.execute('PRAGMA user_version').fetchone()[0] > 1:
                raise RuntimeError('Baza pochodzi z nowszej wersji aplikacji. Nie zmieniono schematu.')
            db.executescript('''
                CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
                INSERT OR IGNORE INTO meta VALUES (1,0);
                CREATE TABLE IF NOT EXISTS trees (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS people (tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(tree_id,id));
                CREATE TABLE IF NOT EXISTS relationships (tree_id TEXT NOT NULL REFERENCES trees(id) ON DELETE CASCADE, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(tree_id,id));
                CREATE TABLE IF NOT EXISTS views (tree_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL);
                PRAGMA user_version=1;
            ''')

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.db, timeout=15)
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def read(self) -> dict[str, Any]:
        with self.connect() as db:
            db.execute('BEGIN')
            revision = db.execute('SELECT revision FROM meta').fetchone()[0]
            trees, links = [], {}
            for tree_id, payload in db.execute('SELECT id,payload FROM trees ORDER BY rowid'):
                tree = json.loads(payload)
                tree['people'] = [json.loads(p[0]) for p in db.execute('SELECT payload FROM people WHERE tree_id=? ORDER BY rowid', (tree_id,))]
                trees.append(tree)
                links[tree_id] = [json.loads(p[0]) for p in db.execute('SELECT payload FROM relationships WHERE tree_id=? ORDER BY rowid', (tree_id,))]
            return dict(revision=revision, trees=trees, connectionsByTree=links)

    def write(self, state: dict[str, Any], media_records: list[dict[str, Any]] | None = None) -> int:
        validate(state)
        previous = self.read()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT revision FROM meta').fetchone()[0] != state['revision']:
                raise Conflict('Dane zmieniono w innym oknie. Odśwież stronę przed kolejnym zapisem.')
            validate_deletions(previous, state)
            for item in media_records or []:
                db.execute('INSERT INTO media VALUES (?,?,?,?)', (item['id'], item['name'], item['mime'], item['size']))
            for tree in state['trees']:
                for person in tree['people']:
                    refs = [person.get('photo', '')] + [a.get('url', '') for a in person.get('attachments', [])]
                    for ref in filter(None, refs):
                        media_id = ref.removeprefix('/api/media/')
                        if not ref.startswith('/api/media/') or not db.execute('SELECT 1 FROM media WHERE id=?', (media_id,)).fetchone():
                            raise ValueError('Zdjęcie lub załącznik nie istnieje w lokalnym magazynie.')
            db.execute('DELETE FROM trees')
            for tree in state['trees']:
                payload = {k: v for k, v in tree.items() if k != 'people'}
                db.execute('INSERT INTO trees VALUES (?,?)', (tree['id'], json.dumps(payload, ensure_ascii=False)))
                for person in tree['people']:
                    db.execute('INSERT INTO people VALUES (?,?,?)', (tree['id'], person['id'], json.dumps(person, ensure_ascii=False)))
                for link in state['connectionsByTree'].get(tree['id'], []):
                    db.execute('INSERT INTO relationships VALUES (?,?,?)', (tree['id'], link['id'], json.dumps(link)))
            db.execute('UPDATE meta SET revision=revision+1')
        return state['revision'] + 1


def validate(state: dict[str, Any]) -> None:
    if not isinstance(state, dict) or not isinstance(state.get('revision'), int):
        raise ValueError('Nieprawidłowa wersja danych.')
    trees = state.get('trees')
    links = state.get('connectionsByTree')
    if not isinstance(trees, list) or not isinstance(links, dict):
        raise ValueError('Nieprawidłowy album.')
    tree_ids = set()
    for tree in trees:
        if not tree.get('id') or tree['id'] in tree_ids or not str(tree.get('name', '')).strip():
            raise ValueError('Drzewo musi mieć unikalny identyfikator i nazwę.')
        tree_ids.add(tree['id'])
        ids = set()
        for person in tree['people']:
            if not person.get('id') or person['id'] in ids or not person.get('firstName', '').strip():
                raise ValueError('Osoba musi mieć imię i unikalny identyfikator.')
            ids.add(person['id'])
        edges, edge_ids, graph = set(), set(), {i: [] for i in ids}
        parent_counts = {}
        for link in links.get(tree['id'], []):
            a, b, kind = link['source'], link['target'], link['kind']
            if a not in ids or b not in ids or a == b or kind not in ('parent', 'adoption', 'partner') or link['id'] in edge_ids:
                raise ValueError('Nieprawidłowe połączenie osób.')
            edge_ids.add(link['id'])
            key = (tuple(sorted((a, b))), kind) if kind == 'partner' else ((a, b), 'parent')
            if key in edges:
                raise ValueError('Powielone połączenie.')
            edges.add(key)
            if kind != 'partner':
                graph[a].append(b)
                parent_counts[b] = parent_counts.get(b, 0) + 1
                if parent_counts[b] > 2:
                    raise ValueError('Osoba może mieć najwyżej dwóch przypisanych rodziców.')
        # Iterative topological traversal also handles long family trees.
        indegree = {i: 0 for i in ids}
        for children in graph.values():
            for child in children:
                indegree[child] += 1
        ready = [i for i in ids if indegree[i] == 0]
        visited = 0
        while ready:
            item = ready.pop()
            visited += 1
            for child in graph[item]:
                indegree[child] -= 1
                if indegree[child] == 0:
                    ready.append(child)
        if visited != len(ids):
            raise ValueError('Relacje rodzic–dziecko tworzą cykl.')
    if set(links) - tree_ids:
        raise ValueError('Połączenia należą do nieistniejącego drzewa.')
