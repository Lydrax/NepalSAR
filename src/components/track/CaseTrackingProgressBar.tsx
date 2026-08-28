'use client';

import React, { useState } from 'react';
import { RescueCaseStatus } from '@/lib/types/emergency';
import {
  Inbox,
  ShieldCheck,
  Users,
  Navigation,
  LifeBuoy,
  CheckCircle2,
  Check,
  AlertTriangle,
  Clock,
  Radio,
} from 'lucide-react';

interface CaseTrackingProgressBarProps {
  status: RescueCaseStatus;
  submittedAt?: string;
  lastUpdatedAt?: string;
  isCompact?: boolean;
}

interface StageDefinition {
  statusKey: RescueCaseStatus;
  label: string;
  labelNe: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ORDERED_STAGES: StageDefinition[] = [
  {
    statusKey: 'SUBMITTED',
    label: 'Request Received',
    labelNe: 'अनुरोध दर्ता भयो',
    shortLabel: 'Submitted',
    description: 'Emergency incident, GPS coordinates, and casualty counts logged into coordination system.',
    icon: Inbox,
  },
  {
    statusKey: 'VERIFIED',
    label: 'Triage Verified',
    labelNe: 'प्राथमिकता प्रमाणित',
    shortLabel: 'Verified',
    description: 'Dispatch coordinators verified caller contact, incident severity, and duplicate checks.',
    icon: ShieldCheck,
  },
  {
    statusKey: 'ASSIGNED',
    label: 'Team Assigned',
    labelNe: 'उद्धार टोली तोकियो',
    shortLabel: 'Assigned',
    description: 'Local SAR unit, Armed Police Force, or Mountain Rescue team dispatched to incident.',
    icon: Users,
  },
  {
    statusKey: 'RESCUER_EN_ROUTE',
    label: 'Rescuers En Route',
    labelNe: 'टोली घटनास्थलतर्फ जाँदै',
    shortLabel: 'En Route',
    description: 'Rescue personnel and ground/air vehicles are actively traveling to the reported coordinates.',
    icon: Navigation,
  },
  {
    statusKey: 'RESCUED',
    label: 'Rescue Completed',
    labelNe: 'उद्धार सम्पन्न भयो',
    shortLabel: 'Rescued',
    description: 'Personnel reached victims on-site. Individuals secured and evacuated to triage/medical aid.',
    icon: LifeBuoy,
  },
  {
    statusKey: 'CLOSED',
    label: 'Case Concluded',
    labelNe: 'केस बन्द गरियो',
    shortLabel: 'Closed',
    description: 'Mission concluded and debriefed. Official records archived by incident command.',
    icon: CheckCircle2,
  },
];

const STATUS_STAGE_INDEX: Record<RescueCaseStatus, number> = {
  SUBMITTED: 0,
  VERIFIED: 1,
  ASSIGNED: 2,
  RESCUER_EN_ROUTE: 3,
  RESCUED: 4,
  CLOSED: 5,
  CANCELLED: -1,
};

export default function CaseTrackingProgressBar({
  status,
  submittedAt,
  lastUpdatedAt,
  isCompact = false,
}: CaseTrackingProgressBarProps) {
  const isCancelled = status === 'CANCELLED';
  const currentStageIndex = STATUS_STAGE_INDEX[status] ?? 0;
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null);

  // If cancelled, show a clear cancellation alert banner and progress indicator
  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2.5 text-red-900 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
          <span>Case Cancelled / Resolved Externally</span>
        </div>
        <p className="text-xs text-red-800 leading-relaxed">
          This rescue request was cancelled by dispatch command, marked as a duplicate, or concluded via direct emergency hotline coordination.
        </p>
        {lastUpdatedAt && (
          <div className="text-[11px] font-mono text-red-700">
            Updated at: {new Date(lastUpdatedAt).toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  // Calculate progress percentage for the continuous loading bar (0% to 100%)
  const totalSteps = ORDERED_STAGES.length - 1;
  const progressPercent = Math.min(100, Math.max(0, (currentStageIndex / totalSteps) * 100));

  // Determine stage to show in details card (either user clicked or active stage)
  const activeDetailStage =
    selectedStageIndex !== null
      ? ORDERED_STAGES[selectedStageIndex]
      : ORDERED_STAGES[currentStageIndex] || ORDERED_STAGES[0];

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {status !== 'CLOSED' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                status === 'CLOSED'
                  ? 'bg-slate-500'
                  : status === 'RESCUED'
                  ? 'bg-emerald-600'
                  : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Live SAR Mission Progression
          </span>
        </div>

        <div className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          Stage {currentStageIndex + 1} of {ORDERED_STAGES.length}:{' '}
          <span className="text-slate-900 font-extrabold">
            {ORDERED_STAGES[currentStageIndex]?.shortLabel}
          </span>
        </div>
      </div>

      {/* 2. Loading Bar With Circles (Desktop / Tablet Horizontal View) */}
      <div className="hidden sm:block pt-4 pb-2 px-3">
        <div className="relative">
          {/* Background Track Bar */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-2.5 bg-slate-200 rounded-full z-0" />

          {/* Active Fill Loading Bar */}
          <div
            className="absolute top-1/2 left-0 -translate-y-1/2 h-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 rounded-full transition-all duration-500 ease-out z-0 shadow-xs"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Pulsing glow animation at the leading edge of the loading bar */}
            {status !== 'CLOSED' && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full blur-xs opacity-75 animate-pulse" />
            )}
          </div>

          {/* Event Circles (Nodes) */}
          <div className="relative z-10 flex items-center justify-between">
            {ORDERED_STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isSelected = selectedStageIndex === idx;
              const IconComp = stage.icon;

              return (
                <button
                  key={stage.statusKey}
                  type="button"
                  onClick={() => setSelectedStageIndex(idx)}
                  className="group flex flex-col items-center focus:outline-none transition-all"
                  title={`${stage.label}: ${stage.description}`}
                >
                  {/* Circle Node */}
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200
                      ${
                        isPast
                          ? 'bg-emerald-600 text-white shadow-xs hover:scale-105'
                          : isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 ring-offset-2 ring-offset-white shadow-md scale-110'
                          : 'bg-white border-2 border-slate-300 text-slate-400 hover:border-slate-400'
                      }
                      ${isSelected ? 'ring-2 ring-slate-800 ring-offset-2' : ''}
                    `}
                  >
                    {isPast ? (
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      <IconComp className="w-5 h-5 animate-pulse" />
                    ) : (
                      <span className="font-mono text-xs font-semibold">{idx + 1}</span>
                    )}
                  </div>

                  {/* Circle Label */}
                  <div className="mt-3 text-center max-w-[85px]">
                    <span
                      className={`
                        block text-[11px] font-bold leading-tight transition-colors
                        ${
                          isCurrent
                            ? 'text-blue-900 font-extrabold'
                            : isPast
                            ? 'text-emerald-950 font-semibold'
                            : 'text-slate-400'
                        }
                      `}
                    >
                      {stage.shortLabel}
                    </span>
                    {isCurrent && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[9px] font-mono font-bold rounded-sm uppercase tracking-tighter">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Mobile View: Responsive Vertical Loading Bar with Circles */}
      <div className="block sm:hidden space-y-3">
        {/* Mobile Mini Continuous Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-600 to-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>Start</span>
            <span>{Math.round(progressPercent)}% Completed</span>
            <span>Resolved</span>
          </div>
        </div>

        {/* Mobile Vertical Connected Nodes */}
        <div className="relative pl-7 space-y-4 pt-2">
          {/* Vertical Connecting Loading Bar Line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-slate-200 -z-0" />
          <div
            className="absolute left-[13px] top-3 w-0.5 bg-gradient-to-b from-emerald-600 to-blue-600 transition-all duration-500 -z-0"
            style={{
              height: `${(currentStageIndex / (ORDERED_STAGES.length - 1)) * 100}%`,
            }}
          />

          {ORDERED_STAGES.map((stage, idx) => {
            const isPast = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const IconComp = stage.icon;

            return (
              <div
                key={stage.statusKey}
                onClick={() => setSelectedStageIndex(idx)}
                className={`relative flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                    : isPast
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50/60 border-slate-200 opacity-60'
                }`}
              >
                {/* Node Circle */}
                <div
                  className={`
                    absolute -left-7 top-2.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10
                    ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }
                  `}
                >
                  {isPast ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : isCurrent ? (
                    <IconComp className="w-3.5 h-3.5 animate-pulse" />
                  ) : (
                    <span className="text-[10px] font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-blue-950'
                          : isPast
                          ? 'text-slate-900'
                          : 'text-slate-500'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 bg-blue-600 text-white font-mono text-[9px] font-bold rounded uppercase">
                        Current
                      </span>
                    )}
                    {isPast && (
                      <span className="text-[10px] text-emerald-700 font-bold font-mono">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Active / Selected Stage Context Card */}
      {!isCompact && activeDetailStage && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            activeDetailStage.statusKey === status
              ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700 shadow-sm'
              : 'bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                    activeDetailStage.statusKey === status
                      ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {activeDetailStage.statusKey === status ? 'Live Operational Event' : 'Stage Overview'}
                </span>
                {selectedStageIndex !== null && selectedStageIndex !== currentStageIndex && (
                  <button
                    type="button"
                    onClick={() => setSelectedStageIndex(null)}
                    className="text-[11px] underline opacity-80 hover:opacity-100"
                  >
                    View Current Stage
                  </button>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-bold flex items-center gap-2">
                {activeDetailStage.label}
                <span className="text-xs font-normal opacity-75">({activeDetailStage.labelNe})</span>
              </h4>
            </div>

            <div
              className={`p-2 rounded-lg shrink-0 ${
                activeDetailStage.statusKey === status
                  ? 'bg-white/10 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              <activeDetailStage.icon className="w-5 h-5" />
            </div>
          </div>

          <p
            className={`text-xs mt-2 leading-relaxed ${
              activeDetailStage.statusKey === status ? 'text-slate-200' : 'text-slate-600'
            }`}
          >
            {activeDetailStage.description}
          </p>

          {/* Contextual Advisory for Current Stage */}
          {activeDetailStage.statusKey === status && (
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {submittedAt
                    ? `Case opened: ${new Date(submittedAt).toLocaleTimeString()}`
                    : 'Real-time telemetry connected'}
                </span>
              </div>
              {status === 'RESCUER_EN_ROUTE' && (
                <div className="flex items-center gap-1 text-amber-300 font-bold">
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                  <span>Keep phone charged & near open sky</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
