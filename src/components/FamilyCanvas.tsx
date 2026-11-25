import { displayGivenName, t, useLanguage } from '../i18n';
import { PersonDirectory } from './PersonDirectory';
import { CanvasFullscreen } from './CanvasFullscreen';
import { TreeBookmarks } from './TreeBookmarks';
import {
  loadTreeView,
  restoreBookmarkView,
  saveTreeView,
  type SavedTreeView,
  type TreeBookmark,
} from '../mocks/treeBookmarks';
import { childRoute, uncrowdedTree } from '../mocks/branchRouting';
import { request } from '../services/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  useNodesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type NodeProps,
  type Node,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import {
  Plus,
  Minus,
  Maximize,
  House,
  Leaf,
  Move,
  RotateCcw,
  Heart,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  DemoConnection,
  Person,
  RelationKind,
  RevealRelative,
} from '../types';
import { demoPositions } from '../mocks/family';
import {
  previewPositions,
  initialTreeView,
  familyGroups,
  hiddenDescendantCount,
  visibleTree,
  toggleTreeChildren,
  toggleTreeParents,
  revealRelativeInTree,
  activePartners,
  partnerChoices,
  cycleTreePartner,
  focusTreePerson,
  partnerViewPositions,
  adjacentPartnerPositions,
} from '../mocks/familyView';
import { Portrait } from './Portrait';
import { EmptyState } from './ui';
import { PersonContextMenu } from './PersonContextMenu';

const displayedFirstName = (person: Person) =>
  person.familiarName?.trim() || displayGivenName(person);

const currentFullName = (person: Person) =>
  `${displayedFirstName(person)} ${person.lastName.trim() || person.maidenName.trim()}`.trim();

type CardData = {
  person: Person;
  portraits: boolean;
  select: (person: Person) => void;
  parents?: { open: boolean; hiddenCount: number; toggle: () => void };
  highlighted?: boolean;
  context: (person: Person, x: number, y: number) => void;
  partnerControl?: {
    index: number;
    count: number;
    name: string;
    previous: () => void;
    next: () => void;
  };
};
type BranchData = {
  label: string;
  open: boolean;
  hiddenCount: number;
  toggle: () => void;
};
type FamilyNode =
  | Node<CardData, 'person'>
  | Node<BranchData, 'branch'>
  | Node<{ label: string }, 'solo'>
  | Node<Record<string, never>, 'junction'>;
function PersonCard({ data }: NodeProps<Node<CardData, 'person'>>) {
  useLanguage();
  const { person, portraits, select, parents } = data;
  return (
    <div
      className={`person-node ${portraits ? '' : 'compact'} ${data.highlighted ? 'search-highlight' : ''} ${person.isPlaceholder ? 'unknown-person' : ''}`}
    >
      <Handle id="top" type="target" position={Position.Top} />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={{ top: portraits ? 151 : 52 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ top: portraits ? 151 : 52 }}
      />
      {parents && (
        <button
          className="branch-toggle top nodrag nopan"
          aria-label={
            parents.open
              ? t('{0} rodziców: {1}', t('Zwiń'), currentFullName(person))
              : t(
                  'Pokaż rodziców: {0} · Dodatkowe osoby: {1}',
                  currentFullName(person),
                  parents.hiddenCount,
                )
          }
          title={
            parents.open
              ? `${t('Zwiń przodków')}: ${currentFullName(person)}`
              : t(
                  'Pokaż rodziców: {0} · Dodatkowe osoby: {1}',
                  currentFullName(person),
                  parents.hiddenCount,
                )
          }
          onClick={parents.toggle}
        >
          {parents.open ? <Minus size={12} /> : <Plus size={12} />}
          {!parents.open && parents.hiddenCount > 0 && (
            <span className="ancestor-count" aria-hidden="true">
              {parents.hiddenCount}
            </span>
          )}
        </button>
      )}
      <button
        className="person-select"
        aria-label={t('Szczegóły: {0}', currentFullName(person))}
        onClick={() => select(person)}
        aria-current={data.highlighted ? 'true' : undefined}
        onKeyDown={(event) => {
          if (
            event.key === 'ContextMenu' ||
            (event.shiftKey && event.key === 'F10')
          ) {
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            data.context(person, box.left + 30, box.top + 30);
          }
        }}
      >
        {portraits && (
          <div className="portrait-frame">
            <Portrait
              variant={person.portrait}
              name={currentFullName(person)}
              photo={person.photo}
              unknown={person.isPlaceholder && !person.customPortrait}
            />
          </div>
        )}
        <div className="wood-name">
          <Leaf className="corner-leaf" size={12} />
          <strong>
            {displayedFirstName(person)}
            <br />
            {person.lastName.trim() || person.maidenName.trim()}
          </strong>
          <span>
            {person.birth || '?'}
            {person.death ? ` — ${person.death}` : ''}
          </span>
          <Leaf className="corner-leaf right" size={12} />
        </div>
      </button>
      {data.partnerControl && (
        <div
          className="partner-selector nodrag nopan"
          aria-label={t('Wybór partnera: {0}', currentFullName(person))}
        >
          <button
            className="partner-previous"
            aria-label={t('Poprzedni partner: {0}', currentFullName(person))}
            title={t(
              'Poprzedni partner ({0}/{1})',
              data.partnerControl.index + 1,
              data.partnerControl.count,
            )}
            onClick={data.partnerControl.previous}
          >
            <ChevronLeft size={15} />
          </button>
          <span
            className="partner-index"
            title={t('Wyświetlony partner: {0}', data.partnerControl.name)}
            aria-live="polite"
          >
            <span className="partner-index-word">{t('Partner')}</span>
            {data.partnerControl.index + 1}/{data.partnerControl.count}
          </span>
          <button
            className="partner-next"
            aria-label={t('Następny partner: {0}', currentFullName(person))}
            title={t(
              'Następny partner ({0}/{1})',
              data.partnerControl.index + 1,
              data.partnerControl.count,
            )}
            onClick={data.partnerControl.next}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      {data.highlighted && (
        <span className="person-location-tag">{t('Tutaj')}</span>
      )}
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={{ bottom: 16 }}
      />
    </div>
  );
}
function BranchControl({ data }: NodeProps<Node<BranchData, 'branch'>>) {
  useLanguage();
  return (
    <div className="line-branch">
      <Handle type="target" position={Position.Top} />
      <button
        className="line-branch-button nodrag nopan"
        aria-label={t(
          '{0} dzieci: {1}{2}',
          t(data.open ? 'Zwiń' : 'Pokaż'),
          data.label,
          data.open ? '' : t(' · Ukryci potomkowie: {0}', data.hiddenCount),
        )}
        title={t(
          '{0} wszystkie dzieci i ich potomków: {1}',
          t(data.open ? 'Zwiń' : 'Pokaż'),
          data.label,
        )}
        onClick={data.toggle}
      >
        {data.open ? <Minus size={13} /> : <Plus size={13} />}
        {!data.open && (
          <span className="collapsed-branch-label">{data.hiddenCount}</span>
        )}
      </button>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function Junction() {
  return (
    <div className="family-junction">
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function SingleParent({ data }: NodeProps<Node<{ label: string }, 'solo'>>) {
  useLanguage();
  return (
    <div
      className="single-parent-junction"
      title={t('Dzieci przypisane tylko do osoby: {0}', data.label)}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <span>{t('Jeden rodzic')}</span>
    </div>
  );
}
function PartnerEdge(props: EdgeProps) {
  useLanguage();
  const [path, x, y] = getSmoothStepPath(props);
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={{ stroke: '#8c6645', strokeWidth: 1.5 }}
      />
      <path
        d={path}
        transform="translate(0 4)"
        fill="none"
        stroke="#8c6645"
        strokeWidth="1.5"
      />
      <EdgeLabelRenderer>
        <span
          className="partner-heart"
          style={{
            transform: `translate(-50%, -50%) translate(${x}px,${y + 2}px)`,
          }}
          title={t('Małżeństwo / partnerstwo')}
        >
          <Heart size={12} />
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
function ChildrenEdge(props: EdgeProps) {
  const busY = Number(props.data?.busY ?? props.sourceY + 16);
  const segment = props.data?.segment as
    { left: number; right: number; trunk: boolean } | undefined;
  if (segment) {
    const path = `${segment.trunk ? `M ${props.sourceX},${props.sourceY} V ${busY} ` : ''}M ${segment.left},${busY} H ${segment.right} M ${props.targetX},${busY} V ${props.targetY}`;
    return <BaseEdge id={props.id} path={path} style={props.style} />;
  }
  const path = `M ${props.sourceX},${props.sourceY} V ${busY} H ${props.targetX} V ${props.targetY}`;
  return <BaseEdge id={props.id} path={path} style={props.style} />;
}
const nodeTypes = {
  person: PersonCard,
  branch: BranchControl,
  junction: Junction,
  solo: SingleParent,
};
const edgeTypes = { partner: PartnerEdge, children: ChildrenEdge };
const FIT_PADDING = {
  top: '70px',
  bottom: '110px',
  left: '35px',
  right: '35px',
} as const;
type SavedCanvas = {
  view: SavedTreeView;
  positions: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
  homeId?: string;
  bookmarks?: TreeBookmark[];
};
type Props = {
  treeId: string;
  saved?: SavedCanvas | null;
  people: Person[];
  connections: DemoConnection[];
  portraits: boolean;
  manual: boolean;
  onDisplayMode: (manual: boolean, portraits: boolean) => void;
  onSelect: (person: Person) => void;
  onNew: () => void;
  onRelation: (person: Person, kind: RelationKind) => void;
  revealRequest: RevealRelative | null;
  focusId: string | null;
};
export function FamilyCanvas(props: Props) {
  useLanguage();
  const [saved, setSaved] = useState<SavedCanvas | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    request<SavedCanvas | null>(
      `/api/trees/${encodeURIComponent(props.treeId)}/view`,
    )
      .then(setSaved)
      .catch((error) => {
        setError(String(error));
      });
  }, [props.treeId]);
  if (error && saved === undefined)
    return (
      <div role="alert">
        {t('Nie udało się wczytać układu.')}
        {error}
        <button className="btn secondary" onClick={() => setSaved(null)}>
          {t('Otwórz układ automatyczny')}
        </button>
      </div>
    );
  if (saved === undefined)
    return (
      <div role="status" className="empty-state">
        {t('Wczytywanie układu drzewa…')}
      </div>
    );
  return (
    <ReactFlowProvider>
      <Canvas {...props} saved={saved} />
    </ReactFlowProvider>
  );
}

function Canvas({
  treeId,
  saved,
  people,
  connections,
  portraits,
  manual,
  onDisplayMode,
  onSelect,
  onNew,
  onRelation,
  revealRequest,
  focusId,
}: Props) {
  const language = useLanguage();
  const [requestedView, setView] = useState(() =>
    saved?.view
      ? loadTreeView(saved.view)
      : initialTreeView(people, connections),
  );
  const [bookmarks, setBookmarks] = useState(saved?.bookmarks ?? []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyNode>([]);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >(saved?.positions || {});
  const [zoom, setZoom] = useState(saved?.viewport?.zoom || 1);
  const [viewport, setViewport] = useState(saved?.viewport);
  const [savedHomeId, setHomeId] = useState(saved?.homeId);
  const homeId = people.some((person) => person.id === savedHomeId)
    ? savedHomeId
    : initialTreeView(people, connections).anchorId;
  const [hoveredEdge, setHoveredEdge] = useState<string>();
  const [focusedEdge, setFocusedEdge] = useState<string>();
  const [saveError, setSaveError] = useState('');
  const pendingView = useRef('');
  const savedView = useRef('');
  const [preferredFamily, setPreferredFamily] = useState<string>();
  const automaticPositions = useMemo(
    () => previewPositions(people, connections, demoPositions),
    [people, connections],
  );
  const automaticLayout = useMemo(
    () =>
      manual
        ? undefined
        : uncrowdedTree(
            people,
            connections,
            requestedView,
            automaticPositions,
            portraits,
            preferredFamily,
          ),
    [
      people,
      connections,
      requestedView,
      automaticPositions,
      portraits,
      preferredFamily,
      manual,
    ],
  );
  const view = automaticLayout?.view ?? requestedView;
  const familyView = useMemo(
    () => automaticLayout?.familyView ?? visibleTree(people, connections, view),
    [automaticLayout, people, connections, view],
  );
  const viewEndpoint = `/api/trees/${encodeURIComponent(treeId)}/view`;
  const viewBody = JSON.stringify({
    view: saveTreeView(view),
    positions,
    viewport,
    homeId,
    bookmarks,
  });
  pendingView.current = viewBody;
  useEffect(() => {
    const flush = () => {
      if (pendingView.current === savedView.current) return;
      void fetch(viewEndpoint, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: pendingView.current,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [viewEndpoint]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void request(viewEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: viewBody,
      })
        .then(() => {
          savedView.current = viewBody;
          setSaveError('');
        })
        .catch(() =>
          setSaveError(
            t('Nie zapisano układu drzewa. Sprawdź połączenie z serwerem.'),
          ),
        );
    }, 500);
    return () => clearTimeout(timer);
  }, [viewEndpoint, viewBody]);
  const flow = useReactFlow();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    token: number;
  } | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const handledReveal = useRef('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    person: Person;
    x: number;
    y: number;
  } | null>(null);
  const closeMenu = useCallback(() => setContextMenu(null), []);
  const showMenu = useCallback(
    (person: Person, x: number, y: number) => setContextMenu({ person, x, y }),
    [],
  );
  const finalPositions = useMemo(
    () =>
      automaticLayout?.positions ??
      adjacentPartnerPositions(people, connections, view, familyView.visible, {
        ...partnerViewPositions(
          people,
          connections,
          view,
          familyView.visible,
          automaticPositions,
        ),
        ...positions,
      }),
    [
      automaticLayout,
      people,
      connections,
      view,
      familyView,
      automaticPositions,
      positions,
    ],
  );
  const selectedPartners = useMemo(
    () => activePartners(people, connections, view),
    [people, connections, view],
  );
  const positionOf = useCallback(
    (id: string) => finalPositions[id] || { x: 0, y: 40 },
    [finalPositions],
  );
  const draggedPair = useRef<{
    id: string;
    start: { x: number; y: number };
    partner?: string;
    partnerStart?: { x: number; y: number };
  } | null>(null);
  const toggleParents = useCallback(
    (id: string) => {
      const next = toggleTreeParents(people, connections, view, id);
      const parentGroup = next.openParents.has(id)
        ? familyGroups(people, connections).find((group) =>
            group.children.some((child) => child.id === id),
          )
        : undefined;
      setPreferredFamily(parentGroup?.id);
      setView(next);
    },
    [people, connections, view],
  );
  const toggleChildren = useCallback(
    (id: string) => {
      const next = toggleTreeChildren(people, connections, view, id);
      setPreferredFamily(
        next !== view && !next.collapsedFamilies.has(id) ? id : undefined,
      );
      setView(next);
    },
    [people, connections, view],
  );
  const cyclePartner = useCallback(
    (id: string, direction: number) => {
      setPreferredFamily(undefined);
      setView(cycleTreePartner(people, connections, view, id, direction));
    },
    [people, connections, view],
  );
  const graph = useMemo(() => {
    const { visible, groups } = familyView;
    const byId = new Map(people.map((person) => [person.id, person]));
    const result: FamilyNode[] = people
      .filter((person) => visible.has(person.id))
      .map((person) => {
        const ownerId = selectedPartners[person.id];
        const choices = ownerId
          ? partnerChoices(people, connections, ownerId)
          : [];
        const chosen = person.id;
        const parentGroup = groups.find((group) =>
          group.children.some((child) => child.id === person.id),
        );
        const parentLinks = connections.filter(
          (link) =>
            (link.kind === 'parent' || link.kind === 'adoption') &&
            link.target === person.id &&
            byId.has(link.source),
        );
        const open =
          !!parentGroup &&
          !view.collapsedFamilies.has(parentGroup.id) &&
          parentLinks.every((link) => visible.has(link.source));
        const hiddenCount =
          !open && parentLinks.length
            ? [
                ...visibleTree(
                  people,
                  connections,
                  toggleTreeParents(people, connections, view, person.id),
                ).visible,
              ].filter((id) => !visible.has(id)).length
            : 0;
        return {
          id: person.id,
          type: 'person',
          position: positionOf(person.id),
          data: {
            person,
            portraits,
            select: onSelect,
            context: showMenu,
            highlighted: person.id === highlightedId,
            partnerControl:
              choices.length > 1
                ? {
                    index: choices.indexOf(chosen),
                    count: choices.length,
                    name: chosen
                      ? currentFullName(byId.get(chosen)!)
                      : t('Nie wybrano'),
                    previous: () => cyclePartner(ownerId!, -1),
                    next: () => cyclePartner(ownerId!, 1),
                  }
                : undefined,
            parents: parentLinks.length
              ? { open, hiddenCount, toggle: () => toggleParents(person.id) }
              : undefined,
          },
          draggable: manual,
        };
      });
    const edges: Edge[] = [];

    const sideHeight = portraits ? 151 : 52;
    for (const link of connections.filter(
      (link) =>
        link.kind === 'partner' &&
        visible.has(link.source) &&
        visible.has(link.target) &&
        selectedPartners[link.source] === link.target,
    )) {
      const left =
        positionOf(link.source).x <= positionOf(link.target).x
          ? link.source
          : link.target;
      const right = left === link.source ? link.target : link.source;
      edges.push({
        id: link.id,
        source: left,
        sourceHandle: 'right',
        target: right,
        targetHandle: 'left',
        type: 'partner',
        data: { relatives: [left, right] },
        ariaLabel: t(
          'Małżeństwo / partnerstwo: {0} i {1}',
          currentFullName(byId.get(left)!),
          currentFullName(byId.get(right)!),
        ),
      });
    }
    for (const group of groups) {
      const firstEdge = edges.length;
      const shownParents = group.parents.filter((id) => visible.has(id));
      const points = shownParents.map(positionOf);
      const {
        x,
        parentBottom,
        children: shownChildren,
        solo,
        busY: defaultBusY,
        soloLane,
      } = childRoute(
        group,
        groups,
        visible,
        positionOf,
        portraits,
        selectedPartners,
      );
      const busY = automaticLayout?.busByFamily.get(group.id) ?? defaultBusY;
      const paired =
        shownParents.length === 2 &&
        connections.some(
          (link) =>
            link.kind === 'partner' &&
            shownParents.includes(link.source) &&
            shownParents.includes(link.target),
        );
      const joint = `family-${group.id}`;
      const control = `children-${group.id}`;
      const stemY = paired
        ? points.reduce((sum, p) => sum + p.y + sideHeight, 0) / points.length +
          17
        : parentBottom + (soloLane ? 17 : 5);
      const hasHiddenNewChildren = group.children.some(
        (child) => view.hiddenPeople?.has(child.id) && !visible.has(child.id),
      );
      const controlY =
        !solo || hasHiddenNewChildren
          ? (stemY + busY) / 2 - 13
          : parentBottom + (soloLane || 18);
      const label = shownParents
        .map((id) => currentFullName(byId.get(id)!))
        .join(t(' i '));
      const open = solo || !view.collapsedFamilies.has(group.id);
      result.push({
        id: joint,
        type: 'junction',
        position: { x: x - 1, y: stemY },
        data: {},
        draggable: false,
        selectable: false,
      });
      if (!paired)
        for (const parent of shownParents)
          edges.push({
            id: `stem-${group.id}-${parent}`,
            source: parent,
            sourceHandle: 'bottom',
            target: joint,
            type: 'children',
            data: { busY: stemY - 1 },
            ariaLabel: t(
              'Linia rodzica: {0}',
              currentFullName(byId.get(parent)!),
            ),
            style: { stroke: '#968267', strokeWidth: 1.6 },
          });
      if (solo && !hasHiddenNewChildren)
        result.push({
          id: control,
          type: 'solo',
          position: { x: x - 1, y: controlY },
          data: { label },
          draggable: false,
          selectable: false,
        });
      else
        result.push({
          id: control,
          type: 'branch',
          position: { x: x - 13, y: controlY },
          data: {
            label,
            open: open && !hasHiddenNewChildren,
            hiddenCount:
              open && !hasHiddenNewChildren
                ? 0
                : hiddenDescendantCount(
                    group.children.map((child) => child.id),
                    connections,
                    visible,
                  ),
            toggle: () => toggleChildren(group.id),
          },
          draggable: false,
          selectable: false,
        });
      edges.push({
        id: `family-stem-${group.id}`,
        source: joint,
        target: control,
        type: 'straight',
        style: { stroke: '#968267', strokeWidth: 1.6 },
      });
      if (open) {
        const ordered = [...shownChildren].sort(
          (a, b) => positionOf(a.id).x - positionOf(b.id).x,
        );
        for (const [index, child] of ordered.entries()) {
          const childX = positionOf(child.id).x + 90;
          const previousX = index
            ? positionOf(ordered[index - 1].id).x + 90
            : childX;
          const left = index === 0 ? Math.min(x, childX) : previousX;
          const right =
            index === ordered.length - 1 ? Math.max(x, childX) : childX;
          edges.push({
            id: `child-${group.id}-${child.id}`,
            source: control,
            target: child.id,
            targetHandle: 'top',
            type: 'children',
            data: {
              busY,
              parentBottom,
              segment: { left, right, trunk: index === 0 },
            },
            style: {
              stroke: child.adopted ? '#6f7c5b' : '#968267',
              strokeWidth: 1.6,
              strokeDasharray: child.adopted ? '6 4' : undefined,
            },
            ariaLabel: `${solo ? t('Jeden rodzic') : child.adopted ? t('Rodzicielstwo adopcyjne') : t('Rodzicielstwo')}: ${label} → ${currentFullName(byId.get(child.id)!)}`,
          });
        }
      }
      const relatives = [
        ...shownParents,
        ...(open ? shownChildren.map((child) => child.id) : []),
      ];
      for (let index = firstEdge; index < edges.length; index++)
        edges[index].data = { ...edges[index].data, relatives };
    }
    return { nodes: result, edges };
  }, [
    people,
    connections,
    view,
    portraits,
    manual,
    onSelect,
    positionOf,
    toggleParents,
    toggleChildren,
    showMenu,
    highlightedId,
    familyView,
    selectedPartners,
    cyclePartner,
    automaticLayout,
    language,
  ]);
  useEffect(() => setNodes(graph.nodes), [graph.nodes, setNodes]);
  const relatedIds = graph.edges.find(
    (edge) => edge.id === (hoveredEdge ?? focusedEdge),
  )?.data?.relatives as string[] | undefined;
  const displayNodes = useMemo(
    () =>
      relatedIds
        ? nodes.map((node) =>
            relatedIds.includes(node.id)
              ? { ...node, className: 'related-person' }
              : node,
          )
        : nodes,
    [nodes, relatedIds],
  );
  // Explicit search/list selections reveal the target, then center the visible canvas.
  useEffect(() => {
    if (focusId) setFocusRequest({ id: focusId, token: performance.now() });
    else setHighlightedId(null);
  }, [focusId]);
  useEffect(() => {
    if (!focusRequest) return;
    pendingFocus.current = focusRequest.id;
    setHighlightedId(null);
    if (!familyView.visible.has(focusRequest.id)) {
      setPreferredFamily(
        familyGroups(people, connections).find((group) =>
          group.children.some((child) => child.id === focusRequest.id),
        )?.id,
      );
      setView(focusTreePerson(people, connections, view, focusRequest.id));
    }
  }, [focusRequest]);
  useEffect(() => {
    const target = graph.nodes.find(
      (node) => node.id === pendingFocus.current && node.type === 'person',
    );
    if (!target) return;
    const id = target.id;
    const timer = setTimeout(() => {
      if (pendingFocus.current !== id) return;
      pendingFocus.current = null;
      flow.setCenter(
        target.position.x + 90,
        target.position.y + (portraits ? 101 : 52),
        { zoom: flow.getZoom(), duration: 350 },
      );
      setHighlightedId(id);
    }, 70);
    return () => clearTimeout(timer);
  }, [graph.nodes, flow, portraits, focusRequest]);
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedId]);
  useEffect(() => {
    if (
      revealRequest &&
      revealRequest.token !== handledReveal.current &&
      people.some((person) => person.id === revealRequest.id) &&
      people.some((person) => person.id === revealRequest.relativeTo)
    ) {
      handledReveal.current = revealRequest.token;
      setView(revealRelativeInTree(people, connections, view, revealRequest));
    }
  }, [revealRequest, people, connections]);
  if (!people.length)
    return (
      <EmptyState
        title={t('Historia zaczyna się od imienia')}
        text={t('Dodaj pierwszą osobę i pozwól temu drzewu zapuścić korzenie.')}
        action={
          <button className="btn primary" onClick={onNew}>
            <Plus size={16} />
            {t('Dodaj pierwszą osobę')}
          </button>
        }
      />
    );
  return (
    <div
      className={`canvas-wrap ${directoryOpen ? 'directory-open' : ''}`}
      onFocusCapture={(event) =>
        setFocusedEdge(
          (event.target as Element)
            .closest('.react-flow__edge')
            ?.getAttribute('data-id') ?? undefined,
        )
      }
      onBlurCapture={() => setFocusedEdge(undefined)}
    >
      <CanvasFullscreen />
      <TreeBookmarks
        bookmarks={bookmarks}
        onSave={(name, color) => {
          const bookmark: TreeBookmark = {
            id: globalThis.crypto.randomUUID(),
            name,
            color,
            view: saveTreeView({ ...view, selectedPartners }),
            knownPersonIds: people.map((person) => person.id),
            positions,
            viewport: flow.getViewport(),
            manual,
            portraits,
          };
          setBookmarks((current) => [...current, bookmark]);
        }}
        onOpen={(bookmark) => {
          setPreferredFamily(undefined);
          setView(
            restoreBookmarkView(bookmark.view, bookmark.knownPersonIds, people),
          );
          setPositions(bookmark.positions);
          onDisplayMode(bookmark.manual, bookmark.portraits);
          setViewport(bookmark.viewport);
          void flow.setViewport(bookmark.viewport);
        }}
        onRemove={(id) =>
          setBookmarks((current) =>
            current.filter((bookmark) => bookmark.id !== id),
          )
        }
      />
      <PersonDirectory
        people={people}
        connections={connections}
        open={directoryOpen}
        onToggle={() => setDirectoryOpen((value) => !value)}
        onFocus={(id) => setFocusRequest({ id, token: performance.now() })}
      />
      {saveError && (
        <div role="alert" className="persistence-status">
          {saveError}
        </div>
      )}
      <ReactFlow
        style={{
          width: directoryOpen ? 'calc(100% - var(--directory-width))' : '100%',
        }}
        nodes={displayNodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesFocusable
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(undefined)}
        onNodesChange={onNodesChange}
        onNodeContextMenu={(event, node) => {
          if (node.type === 'person') {
            event.preventDefault();
            showMenu(node.data.person, event.clientX, event.clientY);
          }
        }}
        onPaneClick={closeMenu}
        onMoveStart={closeMenu}
        onNodeDragStart={(_, node) => {
          const partner = selectedPartners[node.id];
          draggedPair.current = {
            id: node.id,
            start: { ...node.position },
            partner,
            partnerStart:
              partner && familyView.visible.has(partner)
                ? { ...positionOf(partner) }
                : undefined,
          };
        }}
        onNodeDrag={(_, node) => {
          const drag = draggedPair.current;
          if (drag?.id !== node.id || !drag.partner || !drag.partnerStart)
            return;
          const point = {
            x: drag.partnerStart.x + node.position.x - drag.start.x,
            y: drag.partnerStart.y + node.position.y - drag.start.y,
          };
          setNodes((current) =>
            current.map((item) =>
              item.id === drag.partner ? { ...item, position: point } : item,
            ),
          );
        }}
        onNodeDragStop={(_, node) => {
          if (node.type !== 'person') return;
          const drag = draggedPair.current;
          setPositions((current) => {
            const next = { ...current, [node.id]: node.position };
            if (drag?.id === node.id && drag.partner && drag.partnerStart)
              next[drag.partner] = {
                x: drag.partnerStart.x + node.position.x - drag.start.x,
                y: drag.partnerStart.y + node.position.y - drag.start.y,
              };
            return next;
          });
          draggedPair.current = null;
        }}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        fitView={!saved?.viewport}
        defaultViewport={saved?.viewport}
        onMoveEnd={(_, value) => setViewport(value)}
        fitViewOptions={{ padding: FIT_PADDING, maxZoom: 1, minZoom: 0.15 }}
        minZoom={0.1}
        maxZoom={1.6}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#b4a286"
          gap={24}
          size={1}
        />
      </ReactFlow>
      <div className="canvas-hint">
        <Move size={14} />
        {manual
          ? t('Przeciągaj karty, aby ułożyć własne drzewo')
          : t('Przytrzymaj tło, aby przesunąć drzewo')}
      </div>
      <div className="canvas-legend">
        <span>
          <i />
          {t('Rodzice i dzieci')}
        </span>
        <span>
          <i className="dashed" />
          {t('Adopcja')}
        </span>
        <span>
          <i className="partner" />
          <Heart size={10} />
          {t('Małżeństwo / partnerstwo')}
        </span>
      </div>
      <div className="canvas-controls">
        <button
          aria-label={t('Pomniejsz')}
          onClick={() => flow.zoomOut({ duration: 200 })}
        >
          <Minus size={18} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label={t('Powiększ')}
          onClick={() => flow.zoomIn({ duration: 200 })}
        >
          <Plus size={18} />
        </button>
        <div />
        <button
          aria-label={t('Dopasuj całe drzewo')}
          onClick={() => flow.fitView({ padding: FIT_PADDING, duration: 200 })}
        >
          <Maximize size={17} />
        </button>
        <button
          aria-label={t('Wróć do osoby startowej')}
          title={t('Wróć do osoby startowej')}
          onClick={() =>
            homeId && setFocusRequest({ id: homeId, token: performance.now() })
          }
        >
          <House size={18} />
        </button>
        {manual && (
          <button
            aria-label={t('Przywróć pozycje automatyczne')}
            onClick={() => setPositions({})}
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
      <div className="canvas-visible-count" aria-live="polite">
        {t('Widoczne osoby: {0} z {1}', familyView.visible.size, people.length)}
      </div>
      {contextMenu && (
        <PersonContextMenu
          person={contextMenu.person}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeMenu}
          onAdd={(kind) => {
            onRelation(contextMenu.person, kind);
            closeMenu();
          }}
          onDetails={() => {
            onSelect(contextMenu.person);
            closeMenu();
          }}
          isHome={contextMenu.person.id === savedHomeId}
          onSetHome={() => {
            setHomeId(contextMenu.person.id);
            closeMenu();
          }}
        />
      )}
    </div>
  );
}
