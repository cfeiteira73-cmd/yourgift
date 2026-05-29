'use client';

/**
 * DragDropProductionBoard — dnd-kit powered kanban for production scheduling.
 *
 * - Admins can drag order cards between production stages
 * - Optimistic UI: card moves immediately, reverts on API error
 * - Each drop calls PATCH /api/manufacturing with { orderId, newStatus }
 * - Non-admins see a read-only board
 *
 * Uses @dnd-kit/core for drag mechanics and @dnd-kit/sortable for within-column sort.
 */

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderCard {
  id: string;
  ref: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  client?: { name: string | null; company: string | null } | null;
}

interface Stage {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

interface DragDropProductionBoardProps {
  stages: Stage[];
  orders: OrderCard[];
  isAdmin: boolean;
  onOrderMoved?: (orderId: string, newStatus: string) => void;
}

// ── Droppable column ──────────────────────────────────────────────────────────

function DroppableColumn({
  stage,
  items,
  children,
}: {
  stage: Stage;
  items: OrderCard[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? 'rgba(77,163,255,0.06)' : 'rgba(255,255,255,0.018)',
        border: `1px solid ${isOver ? 'rgba(77,163,255,0.3)' : stage.border}`,
        borderRadius: '12px',
        padding: '0.75rem 0.625rem',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '180px',
        minHeight: '200px',
        transition: 'background 150ms, border-color 150ms',
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.625rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${stage.border}` }}>
        <span style={{ fontSize: '0.85rem' }}>{stage.icon}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: stage.color, flex: 1 }}>{stage.label}</span>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, borderRadius: '9999px', padding: '0.1rem 0.4rem' }}>
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={items.map(o => o.id)} strategy={verticalListSortingStrategy}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem', minHeight: '50px' }}>
          {children}
          {items.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '1.5rem 0', color: 'rgb(50,62,80)',
              fontSize: '0.65rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px',
            }}>
              Arrasta aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Sortable card ─────────────────────────────────────────────────────────────

function SortableCard({ order, isDragging }: { order: OrderCard; isDragging?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OrderKanbanCard order={order} isDragging={isDragging} />
    </div>
  );
}

function OrderKanbanCard({ order, isDragging }: { order: OrderCard; isDragging?: boolean }) {
  const client = order.client;
  const days = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);

  return (
    <div style={{
      background: isDragging ? 'rgba(77,163,255,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isDragging ? 'rgba(77,163,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '9px',
      padding: '0.625rem 0.75rem',
      cursor: 'grab',
      boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
      transition: 'background 150ms, border-color 150ms',
      userSelect: 'none',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgb(77,163,255)', marginBottom: '0.2rem', fontFamily: 'monospace' }}>
        {order.ref}
      </div>
      {(client?.company || client?.name) && (
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgb(210,222,240)', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {client.company || client.name}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
        {order.total_amount && (
          <span style={{ fontSize: '0.65rem', color: 'rgb(99,230,190)', fontWeight: 700 }}>
            €{order.total_amount.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
          </span>
        )}
        <span style={{ fontSize: '0.6rem', color: days > 10 ? 'rgb(239,68,68)' : 'rgb(80,92,110)' }}>
          {days}d
        </span>
      </div>
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────

export function DragDropProductionBoard({
  stages,
  orders: initialOrders,
  isAdmin,
  onOrderMoved,
}: DragDropProductionBoardProps) {
  const [orders, setOrders] = useState<OrderCard[]>(initialOrders);
  const [activeOrder, setActiveOrder] = useState<OrderCard | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // require 8px drag to start
    }),
  );

  // Group orders by stage
  const byStage = stages.reduce<Record<string, OrderCard[]>>((acc, s) => {
    acc[s.key] = orders.filter(o => o.status === s.key);
    return acc;
  }, {});

  function handleDragStart({ active }: DragStartEvent) {
    const found = orders.find(o => o.id === active.id);
    if (found) setActiveOrder(found);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const overId = over.id as string;
    // over.id could be a column (stage.key) or another card (order.id)
    const overStage = stages.find(s => s.key === overId);
    const overOrder = orders.find(o => o.id === overId);
    const targetStage = overStage?.key ?? stages.find(s => (byStage[s.key] ?? []).some(o => o.id === overId))?.key;
    if (!targetStage) return;

    const activeOrder = orders.find(o => o.id === active.id);
    if (!activeOrder || activeOrder.status === targetStage) return;

    setOrders(prev => prev.map(o => o.id === active.id ? { ...o, status: targetStage } : o));
  }

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveOrder(null);
    if (!over || !isAdmin) return;

    const overId = over.id as string;
    const overStage = stages.find(s => s.key === overId);
    const targetStage = overStage?.key ?? stages.find(s => (byStage[s.key] ?? []).some(o => o.id === overId))?.key;

    if (!targetStage) return;

    const order = orders.find(o => o.id === active.id);
    if (!order || order.status === targetStage) return;

    const previousStatus = initialOrders.find(o => o.id === active.id)?.status;

    // Optimistic update already done in handleDragOver
    setMovingId(active.id as string);

    try {
      const res = await fetch('/api/manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_stage', orderId: active.id, newStatus: targetStage }),
      });

      if (!res.ok) throw new Error('API error');
      onOrderMoved?.(active.id as string, targetStage);
    } catch {
      // Revert optimistic update
      setOrders(prev => prev.map(o => o.id === active.id ? { ...o, status: previousStatus ?? o.status } : o));
    } finally {
      setMovingId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, stages, isAdmin, onOrderMoved]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stages.length}, minmax(180px, 1fr))`,
        gap: '0.5rem',
        overflowX: stages.length > 5 ? 'auto' : 'hidden',
      }}>
        {stages.map(stage => {
          const items = byStage[stage.key] ?? [];
          return (
            <DroppableColumn key={stage.key} stage={stage} items={items}>
              {items.map(order => (
                isAdmin
                  ? <SortableCard key={order.id} order={order} isDragging={movingId === order.id} />
                  : <OrderKanbanCard key={order.id} order={order} />
              ))}
            </DroppableColumn>
          );
        })}
      </div>

      {/* Drag overlay — renders card under cursor */}
      <DragOverlay>
        {activeOrder ? <OrderKanbanCard order={activeOrder} isDragging /> : null}
      </DragOverlay>

      {!isAdmin && (
        <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'rgb(60,75,95)', marginTop: '0.5rem' }}>
          Apenas admins podem mover encomendas entre etapas
        </div>
      )}
    </DndContext>
  );
}
