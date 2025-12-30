'use client';

/**
 * MOJO Journey Page
 * Visualizes the user's journey through the MOJO graduation system
 * Like martial arts belts - from "hanging in the ropes" to vital entrepreneur
 */

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { motion } from 'framer-motion';
import { 
  Check, 
  Lock, 
  ChevronRight, 
  Zap, 
  Users, 
  Briefcase, 
  Cpu, 
  Target,
  Building2,
  Star,
  Trophy,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// MOJO Journey Stages (Belts)
const JOURNEY_STAGES = [
  {
    id: 'lebensenergie',
    name: 'LEBENSENERGIE',
    subtitle: 'Finde dein MOJO (wieder)',
    color: '#66dd99',
    textColor: '#000000',
    icon: Zap,
    description: 'Der Beginn deiner Transformation. Hier lernst du die Grundlagen der Regeneration und findest zurück zu deiner natürlichen Lebensenergie.',
    milestones: [
      { id: 'le-1', name: 'Energie-Assessment', description: 'Analysiere deinen aktuellen Energielevel' },
      { id: 'le-2', name: 'Schlaf-Optimierung', description: 'Implementiere die MOJO Schlafstrategie' },
      { id: 'le-3', name: 'Ernährungsgrundlagen', description: 'Verstehe die Basics der regenerativen Ernährung' },
      { id: 'le-4', name: 'Bewegungsroutine', description: 'Etabliere deine tägliche Bewegungspraxis' },
      { id: 'le-5', name: 'Stressmanagement', description: 'Lerne Techniken zur Stressregulation' },
      { id: 'le-6', name: 'MOJO Mindset', description: 'Verankere das MOJO Mindset in deinem Alltag' },
    ],
  },
  {
    id: 'campus',
    name: 'CAMPUS',
    subtitle: 'Vernetze dich und optimiere deine Regeneration',
    color: '#ffffff',
    textColor: '#000000',
    borderColor: '#e5e5e5',
    icon: Users,
    description: 'Werde Teil der MOJO Community. Vertiefe dein Wissen und verbinde dich mit Gleichgesinnten auf dem Weg zur optimalen Gesundheit.',
    milestones: [
      { id: 'ca-1', name: 'Community Onboarding', description: 'Trete der MOJO Community bei' },
      { id: 'ca-2', name: 'Mastermind-Teilnahme', description: 'Nimm an deiner ersten Mastermind teil' },
      { id: 'ca-3', name: 'Regenerations-Tracking', description: 'Implementiere fortgeschrittenes Tracking' },
      { id: 'ca-4', name: 'Biohacking Basics', description: 'Erlerne grundlegende Biohacking-Techniken' },
      { id: 'ca-5', name: 'Peer Support', description: 'Unterstütze andere auf ihrer Journey' },
      { id: 'ca-6', name: 'Campus Graduation', description: 'Schließe alle Campus-Module ab' },
    ],
  },
  {
    id: 'bootcamp',
    name: 'BUSINESS BOOTCAMP',
    subtitle: 'Starte dein eigenes Gesundheitsbusiness',
    color: '#0d63bf',
    textColor: '#ffffff',
    icon: Briefcase,
    description: 'Transformiere dein Wissen in ein Business. Lerne die Grundlagen des Gesundheits-Unternehmertums.',
    milestones: [
      { id: 'bb-1', name: 'Business Vision', description: 'Definiere deine Geschäftsidee' },
      { id: 'bb-2', name: 'Zielgruppen-Analyse', description: 'Identifiziere deine idealen Klienten' },
      { id: 'bb-3', name: 'Angebotsstruktur', description: 'Entwickle dein Produktportfolio' },
      { id: 'bb-4', name: 'Marketing Fundamentals', description: 'Lerne die MOJO Marketing-Strategie' },
      { id: 'bb-5', name: 'Erste Klienten', description: 'Gewinne deine ersten zahlenden Klienten' },
      { id: 'bb-6', name: 'Business Launch', description: 'Launche offiziell dein Business' },
    ],
  },
  {
    id: 'rmos',
    name: 'RegenerationsmedizinOS',
    subtitle: 'Das Betriebssystem für chronische Gesundheit',
    color: '#873acf',
    textColor: '#ffffff',
    icon: Cpu,
    description: 'Installiere das komplette Betriebssystem der Regenerationsmedizin. Verstehe die tieferen Zusammenhänge und werde zum Experten.',
    milestones: [
      { id: 'rm-1', name: 'System-Grundlagen', description: 'Verstehe das RMOS Framework' },
      { id: 'rm-2', name: 'Diagnostik-Protokolle', description: 'Lerne fortgeschrittene Diagnostik' },
      { id: 'rm-3', name: 'Interventions-Strategien', description: 'Meistere die Interventionsprotokolle' },
      { id: 'rm-4', name: 'Fallstudien', description: 'Analysiere komplexe Patientenfälle' },
      { id: 'rm-5', name: 'Supervision', description: 'Führe eigene Fälle unter Supervision' },
      { id: 'rm-6', name: 'RMOS Zertifizierung', description: 'Erhalte deine RMOS Zertifizierung' },
    ],
  },
  {
    id: 'praxiszirkel',
    name: 'Praxiszirkel',
    subtitle: 'Behandle Menschen unter Fachleuten',
    color: '#f5bb00',
    textColor: '#000000',
    icon: Target,
    description: 'Werde Teil des exklusiven Praxiszirkels. Lerne von Experten krankheitsspezifische Behandlungsstrategien.',
    milestones: [
      { id: 'pz-1', name: 'Zirkel-Aufnahme', description: 'Werde in den Praxiszirkel aufgenommen' },
      { id: 'pz-2', name: 'Spezialisierung wählen', description: 'Wähle dein Fachgebiet' },
      { id: 'pz-3', name: 'Fallbesprechungen', description: 'Nimm an Fallbesprechungen teil' },
      { id: 'pz-4', name: 'Eigene Protokolle', description: 'Entwickle eigene Behandlungsprotokolle' },
      { id: 'pz-5', name: 'Mentor werden', description: 'Beginne andere zu mentoren' },
      { id: 'pz-6', name: 'Praxiszirkel Master', description: 'Erreiche den Master-Status' },
    ],
  },
  {
    id: 'inkubator',
    name: 'MOJO Inkubator',
    subtitle: 'Eröffne dein eigenes MOJO Institut',
    color: '#000000',
    textColor: '#ffffff',
    icon: Building2,
    description: 'Der Gipfel der MOJO Journey. Werde Franchisepartner und eröffne dein eigenes MOJO Institut.',
    milestones: [
      { id: 'in-1', name: 'Inkubator Bewerbung', description: 'Bewirb dich für den Inkubator' },
      { id: 'in-2', name: 'Business Due Diligence', description: 'Durchlaufe die Eignungsprüfung' },
      { id: 'in-3', name: 'Standort-Analyse', description: 'Analysiere potenzielle Standorte' },
      { id: 'in-4', name: 'Team-Aufbau', description: 'Stelle dein Kernteam zusammen' },
      { id: 'in-5', name: 'Institut Setup', description: 'Richte dein Institut ein' },
      { id: 'in-6', name: 'Grand Opening', description: 'Feiere die Eröffnung deines MOJO Instituts' },
    ],
  },
];

// Mock user progress (will come from backend later)
const USER_PROGRESS = {
  currentStage: 1, // 0-indexed, so 1 = Campus
  completedMilestones: ['le-1', 'le-2', 'le-3', 'le-4', 'le-5', 'le-6', 'ca-1', 'ca-2'],
};

function JourneyContent() {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  const isStageCompleted = (stageIndex: number) => {
    return stageIndex < USER_PROGRESS.currentStage;
  };

  const isStageActive = (stageIndex: number) => {
    return stageIndex === USER_PROGRESS.currentStage;
  };

  const isStageLocked = (stageIndex: number) => {
    return stageIndex > USER_PROGRESS.currentStage;
  };

  const isMilestoneCompleted = (milestoneId: string) => {
    return USER_PROGRESS.completedMilestones.includes(milestoneId);
  };

  const getStageProgress = (stageIndex: number) => {
    const stage = JOURNEY_STAGES[stageIndex];
    const completed = stage.milestones.filter(m => isMilestoneCompleted(m.id)).length;
    return (completed / stage.milestones.length) * 100;
  };

  const getTotalProgress = () => {
    const totalMilestones = JOURNEY_STAGES.reduce((acc, s) => acc + s.milestones.length, 0);
    return (USER_PROGRESS.completedMilestones.length / totalMilestones) * 100;
  };

  // Find next milestone
  const getNextMilestone = () => {
    for (const stage of JOURNEY_STAGES) {
      for (const milestone of stage.milestones) {
        if (!isMilestoneCompleted(milestone.id)) {
          return { stage, milestone };
        }
      }
    }
    return null;
  };

  const nextStep = getNextMilestone();

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Meine MOJO Journey</h1>
            <p className="text-muted-foreground">
              Von der ersten Erkenntnis bis zum eigenen MOJO Institut
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg">{getTotalProgress().toFixed(0)}%</span>
              <span className="text-sm text-muted-foreground">abgeschlossen</span>
            </div>
          </div>
        </div>

        {/* Next Step CTA */}
        {nextStep && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-6"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: nextStep.stage.color }}
              >
                {(() => {
                  const Icon = nextStep.stage.icon;
                  return <Icon className="w-7 h-7" style={{ color: nextStep.stage.textColor }} />;
                })()}
              </div>
              <div className="flex-1">
                <div className="text-sm text-primary font-medium mb-1">Dein nächster Schritt</div>
                <h3 className="text-xl font-bold">{nextStep.milestone.name}</h3>
                <p className="text-sm text-muted-foreground">{nextStep.milestone.description}</p>
              </div>
              <Button className="gap-2 shrink-0">
                Jetzt starten
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Journey Belt Visualization */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        {/* Main Journey Track */}
        <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-3xl p-6 md:p-8">
          {/* Belt Display - Horizontal on larger screens */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {JOURNEY_STAGES.map((stage, index) => {
              const completed = isStageCompleted(index);
              const active = isStageActive(index);
              const locked = isStageLocked(index);

              return (
                <motion.button
                  key={stage.id}
                  onClick={() => !locked && setSelectedStage(selectedStage === index ? null : index)}
                  whileHover={{ scale: locked ? 1 : 1.05 }}
                  whileTap={{ scale: locked ? 1 : 0.95 }}
                  disabled={locked}
                  className={cn(
                    'relative w-14 h-8 md:w-20 md:h-10 rounded-md transition-all duration-300 border-2',
                    locked && 'opacity-40 cursor-not-allowed',
                    !locked && 'cursor-pointer',
                    selectedStage === index && 'ring-2 ring-offset-2 ring-offset-background'
                  )}
                  style={{
                    backgroundColor: locked ? 'hsl(var(--muted))' : stage.color,
                    borderColor: locked ? 'hsl(var(--border))' : (stage.borderColor || stage.color),
                    boxShadow: active ? `0 0 20px ${stage.color}80` : undefined,
                    ['--tw-ring-color' as string]: stage.color,
                  }}
                >
                  {completed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-4 h-4 md:w-5 md:h-5" style={{ color: stage.textColor }} />
                    </div>
                  )}
                  {active && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 rounded-md"
                      style={{ backgroundColor: `${stage.textColor}20` }}
                    />
                  )}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Stages List */}
          <div className="space-y-3">
            {JOURNEY_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const completed = isStageCompleted(index);
              const active = isStageActive(index);
              const locked = isStageLocked(index);
              const progress = getStageProgress(index);
              const isSelected = selectedStage === index;
              const isHovered = hoveredStage === index;

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <motion.button
                    onClick={() => setSelectedStage(isSelected ? null : index)}
                    onMouseEnter={() => setHoveredStage(index)}
                    onMouseLeave={() => setHoveredStage(null)}
                    whileHover={{ scale: locked ? 1 : 1.01 }}
                    disabled={locked}
                    className={cn(
                      'w-full p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 text-left',
                      locked && 'opacity-50 cursor-not-allowed',
                      !locked && 'cursor-pointer',
                      isSelected && 'ring-2 ring-offset-2 ring-offset-background',
                    )}
                    style={{
                      borderColor: locked ? 'hsl(var(--border))' : stage.color,
                      backgroundColor: (isHovered || isSelected) && !locked 
                        ? `${stage.color}10` 
                        : undefined,
                      boxShadow: (isHovered || isSelected) && !locked 
                        ? `0 0 30px ${stage.color}30` 
                        : undefined,
                      ['--tw-ring-color' as string]: stage.color,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Belt Color Indicator */}
                      <div
                        className="w-3 h-12 rounded-full shrink-0"
                        style={{ 
                          backgroundColor: locked ? 'hsl(var(--muted))' : stage.color,
                          border: stage.borderColor ? `1px solid ${stage.borderColor}` : undefined,
                        }}
                      />

                      {/* Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: locked ? 'hsl(var(--muted))' : `${stage.color}20`,
                        }}
                      >
                        {completed ? (
                          <Check className="w-6 h-6" style={{ color: stage.color }} />
                        ) : locked ? (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Icon className="w-6 h-6" style={{ color: stage.color }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="text-xs font-bold tracking-wider px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: locked ? 'hsl(var(--muted))' : stage.color,
                              color: locked ? 'hsl(var(--muted-foreground))' : stage.textColor,
                              border: stage.borderColor ? `1px solid ${stage.borderColor}` : undefined,
                            }}
                          >
                            STUFE {index + 1}
                          </span>
                          {completed && (
                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-medium">
                              ✓ ABGESCHLOSSEN
                            </span>
                          )}
                          {active && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium animate-pulse">
                              ● AKTUELL
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-lg">{stage.name}</h3>
                        <p className="text-sm text-muted-foreground hidden md:block">{stage.subtitle}</p>
                      </div>

                      {/* Progress */}
                      {!locked && (
                        <div className="hidden md:flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{progress.toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">
                              {stage.milestones.filter(m => isMilestoneCompleted(m.id)).length}/{stage.milestones.length} Milestones
                            </div>
                          </div>
                          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>
                        </div>
                      )}

                      <ChevronRight 
                        className={cn(
                          'w-5 h-5 text-muted-foreground transition-transform shrink-0',
                          isSelected && 'rotate-90'
                        )} 
                      />
                    </div>

                    {/* Mobile Progress */}
                    {!locked && (
                      <div className="md:hidden mt-3 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${progress}%`,
                              backgroundColor: stage.color 
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                      </div>
                    )}
                  </motion.button>

                  {/* Expanded Milestones */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 ml-4 md:ml-8 overflow-hidden"
                    >
                      <div
                        className="p-4 rounded-xl border-l-4"
                        style={{ 
                          borderLeftColor: stage.color,
                          backgroundColor: `${stage.color}08`,
                        }}
                      >
                        <p className="text-sm text-muted-foreground mb-4">{stage.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {stage.milestones.map((milestone, mIndex) => {
                            const mCompleted = isMilestoneCompleted(milestone.id);
                            const isNextMilestone = !mCompleted && 
                              stage.milestones.slice(0, mIndex).every(m => isMilestoneCompleted(m.id));

                            return (
                              <motion.div
                                key={milestone.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.03 * mIndex }}
                                className={cn(
                                  'p-3 rounded-xl border transition-all',
                                  mCompleted && 'bg-card border-green-500/30',
                                  isNextMilestone && 'border-primary ring-1 ring-primary/20 bg-primary/5',
                                  !mCompleted && !isNextMilestone && 'border-border opacity-60'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                                      mCompleted ? 'text-white' : 'bg-muted text-muted-foreground'
                                    )}
                                    style={{
                                      backgroundColor: mCompleted ? stage.color : undefined,
                                    }}
                                  >
                                    {mCompleted ? <Check className="w-3.5 h-3.5" /> : mIndex + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-medium text-sm leading-tight">{milestone.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {milestone.description}
                                    </p>
                                    {isNextMilestone && (
                                      <span className="inline-flex items-center gap-1 mt-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-medium">
                                        <Flame className="w-3 h-3" />
                                        Nächster Schritt
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Journey Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-primary">
            {USER_PROGRESS.completedMilestones.length}
          </div>
          <div className="text-sm text-muted-foreground">Milestones erreicht</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div 
            className="text-3xl font-bold"
            style={{ color: JOURNEY_STAGES[USER_PROGRESS.currentStage].color }}
          >
            {USER_PROGRESS.currentStage + 1}
          </div>
          <div className="text-sm text-muted-foreground">Aktuelle Stufe</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-500">
            {JOURNEY_STAGES.length - USER_PROGRESS.currentStage - 1}
          </div>
          <div className="text-sm text-muted-foreground">Stufen bis zum Ziel</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold gradient-text">
            {36 - USER_PROGRESS.completedMilestones.length}
          </div>
          <div className="text-sm text-muted-foreground">Verbleibende Milestones</div>
        </div>
      </motion.div>
    </div>
  );
}

export default function JourneyPage() {
  return (
    <DashboardLayout>
      <JourneyContent />
    </DashboardLayout>
  );
}



