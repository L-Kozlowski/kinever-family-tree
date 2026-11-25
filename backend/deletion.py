"""Prevent deletion from disconnecting any previously connected family."""
from typing import Any


def validate_deletions(previous: dict[str, Any], following: dict[str, Any]) -> None:
    next_trees = {tree['id']: tree for tree in following['trees']}
    for tree in previous['trees']:
        if tree['id'] not in next_trees:
            continue
        old_ids = {person['id'] for person in tree['people']}
        new_ids = {person['id'] for person in next_trees[tree['id']]['people']}
        deleted = old_ids - new_ids
        if not deleted:
            continue
        old_graph = {pid: set() for pid in old_ids}
        new_graph = {pid: set() for pid in new_ids}
        for graph, links in ((old_graph, previous['connectionsByTree'].get(tree['id'], [])), (new_graph, following['connectionsByTree'].get(tree['id'], []))):
            for link in links:
                if link['source'] in graph and link['target'] in graph:
                    graph[link['source']].add(link['target']); graph[link['target']].add(link['source'])
        def reachable(graph, start):
            seen, queue = set(), [start]
            while queue:
                pid = queue.pop()
                if pid in seen:
                    continue
                seen.add(pid); queue.extend(graph[pid] - seen)
            return seen
        for pid in deleted:
            survivors = reachable(old_graph, pid) & new_ids
            if not survivors:
                continue
            connected = reachable(new_graph, next(iter(survivors)))
            if not survivors.issubset(connected) or any(not new_graph[person] for person in survivors):
                raise ValueError('Nie można usunąć osoby: ktoś pozostałby bez połączeń lub rodzina zostałaby rozdzielona. Najpierw uzupełnij połączenia.')
