"use client";

import React from "react";

interface AiOpportunityRadarProps {
  profitability: number;
  demand: number;
  competition: number;
  priceStability: number;
  supplierRisk: number;
  operationalRisk: number;
  opportunityScore: number;
  recommendation: string;
}

export function AiOpportunityRadar({
  profitability,
  demand,
  competition,
  priceStability,
  supplierRisk,
  operationalRisk,
  opportunityScore,
  recommendation,
}: AiOpportunityRadarProps) {
  const axes = [
    { label: "PROFITABILITY", value: profitability },
    { label: "DEMAND", value: demand },
    { label: "COMPETITION", value: competition },
    { label: "PRICE STAB.", value: priceStability },
    { label: "SUPPLIER REL.", value: supplierRisk },
    { label: "OPERATIONAL", value: operationalRisk },
  ];

  const size = 220;
  const center = size / 2;
  const radius = 70;

  const getCoordinates = (index: number, val: number) => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const r = (val / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const gridLevels = [25, 50, 75, 100];

  const polygonPoints = axes
    .map((axis, i) => {
      const pt = getCoordinates(i, axis.value);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");

  const recColor =
    recommendation === "APPROVED_FOR_PURCHASE" ||
    recommendation === "HIGH_MARGIN_SCALER"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : recommendation === "HOLD_FOR_PRICE_DROP"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-red-400 bg-red-500/10 border-red-500/30";

  return (
    <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-2">
        <div>
          <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
            AI Opportunity Score
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-display font-bold text-sky-400">
              {opportunityScore}
            </span>
            <span className="text-xs text-slate-500 font-mono-tech">/ 100</span>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-mono-tech uppercase tracking-wider border ${recColor}`}
        >
          {recommendation.replace(/_/g, " ")}
        </span>
      </div>

      <svg width={size} height={size} className="overflow-visible my-1">
        {gridLevels.map((lvl) => {
          const pts = axes
            .map((_, i) => {
              const pt = getCoordinates(i, lvl);
              return `${pt.x},${pt.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke="#1F293D"
              strokeWidth="1"
              strokeDasharray={lvl === 100 ? "none" : "2,2"}
            />
          );
        })}

        {axes.map((_, i) => {
          const endPt = getCoordinates(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endPt.x}
              y2={endPt.y}
              stroke="#1F293D"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(14, 165, 233, 0.22)"
          stroke="#0EA5E9"
          strokeWidth="2"
        />

        {axes.map((axis, i) => {
          const pt = getCoordinates(i, axis.value);
          const labelPt = getCoordinates(i, 122);
          return (
            <g key={axis.label}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                className="fill-sky-400 stroke-[#0B0F17] stroke-2"
              />
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] fill-slate-400 font-mono-tech font-medium tracking-tight"
              >
                {axis.label} ({axis.value})
              </text>
            </g>
          );
        })}
      </svg>

      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 border-t border-slate-800/80 pt-2.5">
        {axes.map((axis) => (
          <div key={axis.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px] font-mono-tech">
              {axis.label}
            </span>
            <span
              className={`font-mono-tech font-semibold ${
                axis.value >= 85
                  ? "text-emerald-400"
                  : axis.value >= 70
                  ? "text-sky-400"
                  : "text-amber-400"
              }`}
            >
              {axis.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
