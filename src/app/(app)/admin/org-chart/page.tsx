"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TIER_LABELS, TIER_SHORT } from "@/lib/constants"
import { Plus, X, Save, RotateCcw, Users, Download } from "lucide-react"
import { useExportOrgChartPdf } from "@/hooks/useExportOrgChartPdf"

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
    },
  })

  const handleSave = () => {
    if (!tree) return
    const assignments = flattenAssignments(tree, null)
    saveMutation.mutate(assignments)
  }

  const handleReset = () => {
    if (allUsers.length > 0) {
      setTree(buildTreeFromUsers(allUsers))
      setHasChanges(false)
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

  const unplacedCount = allUsers.filter(u => !usedIds.has(u.id) && u.role !== "ADMIN").length

  return (
    <div>
      <PageHeader
        title="Org Chart"
        description="Build the reporting hierarchy by selecting users for each position"
        action={
          <div className="flex items-center gap-2">
            {unplacedCount > 0 && (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                {unplacedCount} unplaced
              </span>
            )}
            <button
              onClick={() => exportPdf("admin-org-chart", "org-chart.pdf")}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting…" : "Export PDF"}
            </button>
            {hasChanges && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-card-hover"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save Chart"}
            </button>
          </div>
        }
      />

      {saveMutation.isError && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {saveMutation.error?.message}
        </div>
      )}

      {saveMutation.isSuccess && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
          Org chart saved successfully.
        </div>
      )}

      {/* Chart */}
      <div id="admin-org-chart" className="overflow-x-auto rounded-xl border border-card-border bg-card-bg p-8">
        <div className="flex min-w-max flex-col items-center">
          <OrgNodeCard
            node={tree}
            allUsers={allUsers}
            usedIds={usedIds}
            isRoot
            onSetUser={setUserId}
            onAddChild={addChild}
            onRemove={removeNodeById}
          />
        </div>
      </div>

      {/* Unplaced users legend */}
      {unplacedCount > 0 && (
        <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground-secondary">
            <Users className="h-4 w-4" />
            Unplaced Users ({unplacedCount})
          </div>
          <div className="flex flex-wrap gap-2">
            {allUsers
              .filter(u => !usedIds.has(u.id) && u.role !== "ADMIN")
              .map(u => (
                <span key={u.id} className="rounded-lg border border-border bg-background-secondary px-3 py-1 text-xs text-foreground-muted">
                  {u.firstName} {u.lastName}
                  <span className="ml-1.5 text-foreground-muted/50">· {TIER_SHORT[u.tier] ?? u.tier}</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
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

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div className={`relative w-52 rounded-xl border bg-card-bg p-3 shadow-sm transition-colors ${
        user
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-dashed border-border"
      }`}>
        {/* Remove button (not on root) */}
        {!isRoot && (
          <button
            onClick={() => onRemove(node.nodeId)}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card-bg text-foreground-muted hover:border-red-500/50 hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* User select */}
        <select
          value={node.userId ?? ""}
          onChange={e => onSetUser(node.nodeId, e.target.value || null)}
          className={`w-full rounded-lg border bg-input px-2 py-1.5 text-sm outline-none focus:border-blue-500 ${
            user ? "border-blue-500/30 text-foreground" : "border-border text-foreground-muted"
          }`}
        >
          <option value="">— Select user —</option>
          {options.map(u => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>

        {/* User info */}
        {user && (
          <div className="mt-2 space-y-0.5">
            <p className="text-xs font-medium text-foreground">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-foreground-muted">
              {TIER_LABELS[user.tier as keyof typeof TIER_LABELS]}
            </p>
            {user.jobTitle && (
              <p className="text-[11px] text-foreground-muted/70">{user.jobTitle}</p>
            )}
          </div>
        )}

        {/* Add child button */}
        <button
          onClick={() => onAddChild(node.nodeId)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-xs text-foreground-muted transition-colors hover:border-blue-500/50 hover:text-blue-400"
        >
          <Plus className="h-3 w-3" />
          Add subordinate
        </button>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from parent */}
          <div className="h-6 w-px bg-border" />

          {/* Horizontal connector + children */}
          <div className="relative flex items-start gap-6">
            {/* Horizontal line — spans from center of first child to center of last */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{ left: "calc(104px)", right: "calc(104px)" }}
              />
            )}

            {node.children.map((child) => (
              <div key={child.nodeId} className="flex flex-col items-center">
                {/* Vertical drop to child */}
                <div className="h-6 w-px bg-border" />
                <OrgNodeCard
                  node={child}
                  allUsers={allUsers}
                  usedIds={usedIds}
                  onSetUser={onSetUser}
                  onAddChild={onAddChild}
                  onRemove={onRemove}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
