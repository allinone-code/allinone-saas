"use client";

import React from "react";

interface CostHistoryEntry {
  date: string;
  sourcePrice: number;
  landedCost: number;
  sellingPrice: number;
  roi: number;
}

export function CostHistoryChart({ history }: { history: CostHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4 text-center text-xs text-slate-500 font-mono-tech">
        No cost history recorded yet.
      </div>
    );
  }

  const entries =
    history.length === 1
      ? [
          {
            ...history[0],
            date: "Initial Capture",
          },
          history[0],
        ]
      : history;

  const maxVal = Math.max(
    ...entries.map((e) => Math.max(e.sourcePrice, e.landedCost, e.sellingPrice)),
    10
  );
  const minVal = 0;

  const width = 360;
  const height = 110;
  const paddingX = 24;
  const paddingY = 16;

  const getX = (idx: number) =>
    paddingX +
    (idx / Math.max(1, entries.length - 1)) * (width - paddingX * 2);
  const getY = (val: number) =>
    height -
    paddingY -
    ((val - minVal) / (maxVal - minVal || 1)) * (height - paddingY * 2);

  const pointsLanded = entries
    .map((e, idx) => `${getX(idx)},${getY(e.landedCost)}`)
    .join(" ");

  const areaLanded = `${getX(0)},${height - paddingY} ${pointsLanded} ${getX(
    entries.length - 1
  )},${height - paddingY}`;

  const pointsSelling = entries
    .map((e, idx) => `${getX(idx)},${getY(e.sellingPrice)}`)
    .join(" ");

  const pointsSource = entries
    .map((e, idx) => `${getX(idx)},${getY(e.sourcePrice)}`)
    .join(" ");

  return (
    <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
          Landed Cost vs Selling Price Timeline
        </span>
        <div className="flex items-center gap-3 text-[11px] font-mono-tech">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Sale Price
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Landed Cost
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Source Price
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = height - paddingY - pct * (height - paddingY * 2);
          return (
            <line
              key={pct}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#1F293D"
              strokeDasharray="2,3"
            />
          );
        })}

        <polygon points={areaLanded} fill="rgba(14, 165, 233, 0.12)" />

        <polyline
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
          points={pointsSelling}
        />

        <polyline
          fill="none"
          stroke="#0EA5E9"
          strokeWidth="2"
          points={pointsLanded}
        />

        <polyline
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeDasharray="3,3"
          points={pointsSource}
        />

        {entries.map((e, idx) => (
          <g key={idx}>
            <circle
              cx={getX(idx)}
              cy={getY(e.sellingPrice)}
              r="3"
              fill="#10B981"
            />
            <circle
              cx={getX(idx)}
              cy={getY(e.landedCost)}
              r="3"
              fill="#0EA5E9"
            />
            <text
              x={getX(idx)}
              y={height - 2}
              textAnchor="middle"
              className="text-[9px] fill-slate-500 font-mono-tech"
            >
              {e.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
