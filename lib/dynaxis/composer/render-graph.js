import { z } from 'zod';

export const renderGraphNodeSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['source', 'clip', 'effect', 'mix', 'export']),
  clipId: z.string().uuid().optional().nullable(),
  effectStackId: z.string().uuid().optional().nullable(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const renderGraphEdgeSchema = z.object({
  id: z.string().uuid(),
  from: z.string().uuid(),
  to: z.string().uuid(),
});

export const renderGraphSchema = z
  .object({
    nodes: z.array(renderGraphNodeSchema).min(1),
    edges: z.array(renderGraphEdgeSchema).default([]),
  })
  .superRefine((graph, ctx) => {
    try {
      validateRenderGraphAcyclic(graph);
    } catch (err) {
      ctx.addIssue({
        code: 'custom',
        path: ['edges'],
        message: err.message,
      });
    }
  });

/**
 * @param {z.infer<typeof renderGraphSchema>} graph
 */
export function validateRenderGraphAcyclic(graph) {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (nodeIds.size !== graph.nodes.length) {
    throw new Error('render graph contains duplicate node ids');
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`render graph edge ${edge.id} references unknown node ids`);
    }
  }

  const adjacency = new Map();
  const indegree = new Map();
  for (const id of nodeIds) {
    adjacency.set(id, []);
    indegree.set(id, 0);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  }

  const queue = [];
  for (const [id, degree] of indegree.entries()) {
    if (degree === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    visited += 1;
    for (const next of adjacency.get(id)) {
      const nextDegree = indegree.get(next) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) queue.push(next);
    }
  }

  if (visited !== graph.nodes.length) {
    throw new Error('render graph must be acyclic');
  }
}

/**
 * @param {unknown} input
 */
export function parseRenderGraph(input) {
  return renderGraphSchema.parse(input);
}
