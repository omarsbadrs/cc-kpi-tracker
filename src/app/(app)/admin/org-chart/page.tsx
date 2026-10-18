"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Plus, RotateCcw, Save, X } from "lucide-react"
import { PageHead } from "@/components/ui/PageHead"
import { SelectWrap } from "@/components/ui/Field"
import { StatusChip, TagPill } from "@/components/ui/StatusChip"
import { useToast } from "@/components/ui/Toast"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { UserAvatar } from "@/components/layout/UserMenu"
import { TIER_LABELS, TIER_SHORT } from "@/lib/constants"
import { useExportOrgChartPdf } from "@/hooks/useExportOrgChartPdf"
import "@/styles/views/org-chart.css"

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

interface UserOption {
  id: string
  firstName: string
  lastName: string
  tier: string
  role: string
  jobTitle: string | null
  managerId: string | null
}

interface OrgNode {
  nodeId: string   // internal React key (not userId)
  userId: string | null
  children: OrgNode[]
}

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

let _nodeCounter = 0
function newNodeId() { return `node-${++_nodeCounter}` }

function collectUsedIds(node: OrgNode): Set<string> {
  const ids = new Set<string>()
  function walk(n: OrgNode) {
    if (n.userId) ids.add(n.userId)
    for (const c of n.children) walk(c)
  }
  walk(node)
  return ids
}

/** Build a tree from existing managerId relations on users */
function buildTreeFromUsers(users: UserOption[]): OrgNode {
  const userMap = new Map(users.map(u => [u.id, u]))

  // Find root: users whose manager is null OR manager not in the list
  const roots = users.filter(u => !u.managerId || !userMap.has(u.managerId))

  function buildNode(user: UserOption): OrgNode {
    const reports = users.filter(u => u.managerId === user.id)
    return {
      nodeId: newNodeId(),
      userId: user.id,
      children: reports.map(buildNode),
    }
  }

  if (roots.length === 0) {
    return { nodeId: newNodeId(), userId: null, children: [] }
  }
  if (roots.length === 1 && roots[0]) {
    return buildNode(roots[0])
  }
  // Multiple roots — wrap in virtual root
  return {
    nodeId: newNodeId(),
    userId: null,
    children: roots.map(buildNode),
  }
}

/** Flatten tree into (userId → parentUserId) pairs for saving */
function flattenAssignments(node: OrgNode, parentUserId: string | null): Array<{ userId: string; managerId: string | null }> {
  const results: Array<{ userId: string; managerId: string | null }> = []
  if (node.userId) {
    results.push({ userId: node.userId, managerId: parentUserId })
  }
  const effectiveParent = node.userId ?? parentUserId
  for (const child of node.children) {
    results.push(...flattenAssignments(child, effectiveParent))
  }
  return results
}

function updateNode(root: OrgNode, nodeId: string, updater: (n: OrgNode) => OrgNode): OrgNode {
  if (root.nodeId === nodeId) return updater(root)
  return { ...root, children: root.children.map(c => updateNode(c, nodeId, updater)) }
}

function removeNode(root: OrgNode, nodeId: string): OrgNode {
  return {
    ...root,
    children: root.children
      .filter(c => c.nodeId !== nodeId)
      .map(c => removeNode(c, nodeId)),
  }
}

// ─────────────────────────────────────
// Page
// ─────────────────────────────────────

export default function OrgChartPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { exportPdf, isExporting } = useExportOrgChartPdf()

  const { data, isLoading } = useQuery({
    queryKey: ["team-hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/team")
      if (!res.ok) throw new Error("Failed to fetch team")
      const json = await res.json()
      return json.data as { allUsers: UserOption[] }
    },
  })

  const allUsers = data?.allUsers ?? []

  // Initialise tree once users load
  const [tree, setTree] = useState<OrgNode | null>(null)
  const [initialised, setInitialised] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  if (!initialised && allUsers.length > 0) {
    setTree(buildTreeFromUsers(allUsers))
    setInitialised(true)
  }

  const usedIds = useMemo(() => tree ? collectUsedIds(tree) : new Set<string>(), [tree])

  // ── mutations ──
  const saveMutation = useMutation({
    mutationFn: async (assignments: Array<{ userId: string; managerId: string | null }>) => {
      // Group by managerId to batch calls
      const byManager = new Map<string | null, string[]>()
      for (const { userId, managerId } of assignments) {
        if (!byManager.has(managerId)) byManager.set(managerId, [])
        byManager.get(managerId)!.push(userId)
      }

      for (const [managerId, userIds] of byManager) {
        const res = await fetch("/api/team", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds, managerId }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error?.message || "Save failed")
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-hierarchy"] })
      setHasChanges(false)
      toast("Org chart saved")
    },
    onError: (error: Error) => {
      toast(`Could not save the org chart. ${error.message}`.replace(/\.$/, ""), { icon: "alert" })
    },
  })

  const handleSave = () => {
    if (!tree || saveMutation.isPending) return
    const assignments = flattenAssignments(tree, null)
    saveMutation.mutate(assignments)
  }

  const handleReset = () => {
    if (allUsers.length > 0) {
      setTree(buildTreeFromUsers(allUsers))
      setHasChanges(false)
    }
  }

  const handleExport = async () => {
    if (isExporting) return
    try {
      await exportPdf("admin-org-chart", "org-chart.pdf")
    } catch {
      toast("Could not export the PDF. Try again", { icon: "alert" })
    }
  }

  // ── node actions ──
  const setUserId = useCallback((nodeId: string, userId: string | null) => {
    setTree(prev => prev ? updateNode(prev, nodeId, n => ({ ...n, userId })) : prev)
    setHasChanges(true)
  }, [])

  const addChild = useCallback((nodeId: string) => {
    setTree(prev => prev ? updateNode(prev, nodeId, n => ({
      ...n,
      children: [...n.children, { nodeId: newNodeId(), userId: null, children: [] }],
    })) : prev)
    setHasChanges(true)
  }, [])

  const removeNodeById = useCallback((nodeId: string) => {
    setTree(prev => prev ? removeNode(prev, nodeId) : prev)
    setHasChanges(true)
  }, [])

  if (isLoading || !tree) return <LoadingSpinner />

  const unplaced = allUsers.filter(u => !usedIds.has(u.id) && u.role !== "ADMIN")
  const unplacedCount = unplaced.length
  const isSaving = saveMutation.isPending

  return (
    <>
      <PageHead
        title="Org chart"
        sub="Build the reporting hierarchy by choosing a person for each position"
        titleAside={
          unplacedCount > 0 ? <StatusChip tone="warn">{unplacedCount} unplaced</StatusChip> : undefined
        }
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={handleExport}
              aria-disabled={isExporting ? "true" : undefined}
            >
              <Download size={16} strokeWidth={1.7} aria-hidden="true" />
              {isExporting ? "Exporting…" : "Export PDF"}
            </button>
            {hasChanges && (
              <button type="button" className="btn btn-ghost" onClick={handleReset}>
                <RotateCcw size={15} strokeWidth={1.7} aria-hidden="true" />
                Reset
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!hasChanges && !isSaving}
              title={!hasChanges && !isSaving ? "No changes to save" : undefined}
              aria-disabled={isSaving ? "true" : undefined}
            >
              <Save size={16} strokeWidth={1.8} aria-hidden="true" />
              {isSaving ? "Saving…" : "Save chart"}
            </button>
          </>
        }
      />

      {/* Chart */}
      <section className="card list-card">
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Org chart">
          <div id="admin-org-chart" className="org-tree">
            <ul>
              <OrgNodeCard
                node={tree}
                allUsers={allUsers}
                usedIds={usedIds}
                isRoot
                onSetUser={setUserId}
                onAddChild={addChild}
                onRemove={removeNodeById}
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Unplaced users */}
      {unplacedCount > 0 && (
        <section className="card">
          <div className="card-head">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="card-title">Unplaced people</h2>
              <TagPill>{unplacedCount}</TagPill>
            </div>
          </div>
          <p className="card-sub">Not in any position yet. Choose them in a position above to place them.</p>
          <div className="person-pills">
            {unplaced.map(u => (
              <span key={u.id} className="tag-pill">
                {u.firstName} {u.lastName}
                <span className="muted" style={{ marginInlineStart: 6 }}>· {TIER_SHORT[u.tier] ?? u.tier}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ─────────────────────────────────────
// OrgNodeCard
// ─────────────────────────────────────

function OrgNodeCard({
  node,
  allUsers,
  usedIds,
  isRoot = false,
  onSetUser,
  onAddChild,
  onRemove,
}: {
  node: OrgNode
  allUsers: UserOption[]
  usedIds: Set<string>
  isRoot?: boolean
  onSetUser: (nodeId: string, userId: string | null) => void
  onAddChild: (nodeId: string) => void
  onRemove: (nodeId: string) => void
}) {
  const user = allUsers.find(u => u.id === node.userId)

  // Options: unselected users + this node's current user
  const options = allUsers.filter(u =>
    !usedIds.has(u.id) || u.id === node.userId
  )

  const selectId = `org-select-${node.nodeId}`
  const personName = user ? `${user.firstName} ${user.lastName}` : null

  return (
    <li>
      <div className={`org-node${user ? "" : " vacant"}`}>
        <div className="org-node-head">
          <label htmlFor={selectId} className="sr-only">
            {personName ? `Person in ${personName}'s position` : "Person in this position"}
          </label>
          <div className="min-w-0 flex-1">
            <SelectWrap>
              <select
                id={selectId}
                className="select"
                value={node.userId ?? ""}
                onChange={e => onSetUser(node.nodeId, e.target.value || null)}
              >
                <option value="">Select a person</option>
                {options.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </div>
          {/* Remove button (not on root) */}
          {!isRoot && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onRemove(node.nodeId)}
              aria-label={personName ? `Remove ${personName}'s position` : "Remove this position"}
              title="Remove position"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* User info */}
        {user && (
          <div className="org-node-head">
            <UserAvatar firstName={user.firstName} lastName={user.lastName} />
            <div className="org-node-text">
              <span className="org-node-name">{user.firstName} {user.lastName}</span>
              {user.jobTitle && <span className="org-node-sub">{user.jobTitle}</span>}
            </div>
          </div>
        )}
        {user && (
          <div className="org-node-tags">
            <TagPill>{TIER_LABELS[user.tier as keyof typeof TIER_LABELS] ?? user.tier}</TagPill>
          </div>
        )}

        {/* Add child button */}
        <button
          type="button"
          className="btn btn-sm btn-block"
          onClick={() => onAddChild(node.nodeId)}
        >
          <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
          Add subordinate
        </button>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <OrgNodeCard
              key={child.nodeId}
              node={child}
              allUsers={allUsers}
              usedIds={usedIds}
              onSetUser={onSetUser}
              onAddChild={onAddChild}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
