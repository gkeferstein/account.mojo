'use client';

/**
 * MOJO Journey Page
 * Visualizes the user's journey through the MOJO graduation system
 * Like martial arts belts - from "hanging in the ropes" to vital entrepreneur
 */

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

export default function JourneyPage() {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="w-4 h-4" />
          Dein Fortschritt: {getTotalProgress().toFixed(0)}%
        </div>
        <h1 className="text-4xl font-bold mb-2">Meine MOJO Journey</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Von der ersten Erkenntnis bis zum eigenen MOJO Institut – 
          verfolge deinen Weg durch das MOJO Graduierungssystem.
        </p>
      </motion.div>

      {/* Journey Belt Visualization */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-3xl" />
        
        {/* Main Journey Track */}
        <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-3xl p-8">
          {/* Progress Line */}
          <div className="absolute left-1/2 top-24 bottom-24 w-1 -translate-x-1/2 bg-border rounded-full overflow-hidden">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${getTotalProgress()}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="w-full bg-gradient-to-b from-[#66dd99] via-[#873acf] to-[#000000] rounded-full"
            />
          </div>

          {/* Stages */}
          <div className="relative space-y-4">
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
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={cn(
                    'relative grid grid-cols-[1fr_auto_1fr] gap-8 items-center',
                    index % 2 === 0 ? '' : 'direction-rtl'
                  )}
                >
                  {/* Stage Card (Left or Right based on index) */}
                  <div className={cn(
                    index % 2 === 0 ? 'text-right' : 'text-left order-3'
                  )}>
                    <motion.button
                      onClick={() => setSelectedStage(isSelected ? null : index)}
                      onMouseEnter={() => setHoveredStage(index)}
                      onMouseLeave={() => setHoveredStage(null)}
                      whileHover={{ scale: locked ? 1 : 1.02 }}
                      whileTap={{ scale: locked ? 1 : 0.98 }}
                      disabled={locked}
                      className={cn(
                        'w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left',
                        locked && 'opacity-50 cursor-not-allowed',
                        !locked && 'cursor-pointer hover:shadow-lg',
                        isSelected && 'ring-2 ring-offset-2 ring-offset-background',
                        completed && 'bg-card',
                        active && 'bg-card shadow-lg'
                      )}
                      style={{
                        borderColor: locked ? 'hsl(var(--border))' : stage.color,
                        boxShadow: (isHovered || isSelected) && !locked 
                          ? `0 0 30px ${stage.color}40` 
                          : undefined,
                        ['--tw-ring-color' as string]: stage.color,
                      }}
                    >
                      <div className="flex items-start gap-4">
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                            {active && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                                AKTUELL
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-lg mb-1">{stage.name}</h3>
                          <p className="text-sm text-muted-foreground">{stage.subtitle}</p>
                          
                          {/* Progress Bar */}
                          {!locked && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Fortschritt</span>
                                <span className="font-medium">{progress.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 0.5, delay: 0.2 * index }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {!locked && (
                          <ChevronRight 
                            className={cn(
                              'w-5 h-5 text-muted-foreground transition-transform',
                              isSelected && 'rotate-90'
                            )} 
                          />
                        )}
                      </div>
                    </motion.button>
                  </div>

                  {/* Center Belt Node */}
                  <div className="relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={cn(
                        'w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all',
                        locked ? 'bg-muted border-border' : 'bg-card'
                      )}
                      style={{
                        borderColor: locked ? undefined : stage.color,
                        boxShadow: !locked ? `0 0 20px ${stage.color}60` : undefined,
                      }}
                    >
                      {completed ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: stage.color }}
                        >
                          <Check className="w-6 h-6" style={{ color: stage.textColor }} />
                        </div>
                      ) : active ? (
                        <div className="relative">
                          <Flame className="w-6 h-6" style={{ color: stage.color }} />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 rounded-full"
                            style={{ backgroundColor: `${stage.color}20` }}
                          />
                        </div>
                      ) : (
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      )}
                    </motion.div>
                  </div>

                  {/* Empty space on opposite side */}
                  <div className={index % 2 === 0 ? 'order-3' : ''} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Selected Stage Details */}
      {selectedStage !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          {/* Stage Header */}
          <div
            className="p-6"
            style={{
              backgroundColor: `${JOURNEY_STAGES[selectedStage].color}15`,
              borderBottom: `2px solid ${JOURNEY_STAGES[selectedStage].color}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: JOURNEY_STAGES[selectedStage].color }}
              >
                {(() => {
                  const Icon = JOURNEY_STAGES[selectedStage].icon;
                  return <Icon className="w-7 h-7" style={{ color: JOURNEY_STAGES[selectedStage].textColor }} />;
                })()}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{JOURNEY_STAGES[selectedStage].name}</h2>
                <p className="text-muted-foreground">{JOURNEY_STAGES[selectedStage].subtitle}</p>
              </div>
            </div>
            <p className="mt-4 text-sm">{JOURNEY_STAGES[selectedStage].description}</p>
          </div>

          {/* Milestones Grid */}
          <div className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Milestones ({JOURNEY_STAGES[selectedStage].milestones.filter(m => isMilestoneCompleted(m.id)).length}/{JOURNEY_STAGES[selectedStage].milestones.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {JOURNEY_STAGES[selectedStage].milestones.map((milestone, mIndex) => {
                const completed = isMilestoneCompleted(milestone.id);
                const isNext = !completed && 
                  JOURNEY_STAGES[selectedStage].milestones
                    .slice(0, mIndex)
                    .every(m => isMilestoneCompleted(m.id));

                return (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * mIndex }}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all',
                      completed && 'bg-primary/5 border-primary/30',
                      isNext && 'border-primary ring-2 ring-primary/20 bg-primary/5',
                      !completed && !isNext && 'border-border opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                          completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {completed ? <Check className="w-4 h-4" /> : mIndex + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{milestone.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
                        {isNext && (
                          <span className="inline-block mt-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded font-medium">
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

      {/* Journey Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-card/50 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-primary">
            {USER_PROGRESS.completedMilestones.length}
          </div>
          <div className="text-sm text-muted-foreground">Milestones erreicht</div>
        </div>
        <div className="bg-card/50 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold" style={{ color: JOURNEY_STAGES[USER_PROGRESS.currentStage].color }}>
            {USER_PROGRESS.currentStage + 1}
          </div>
          <div className="text-sm text-muted-foreground">Aktuelle Stufe</div>
        </div>
        <div className="bg-card/50 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-500">
            {JOURNEY_STAGES.length - USER_PROGRESS.currentStage - 1}
          </div>
          <div className="text-sm text-muted-foreground">Stufen bis zum Ziel</div>
        </div>
        <div className="bg-card/50 border border-border rounded-xl p-4 text-center">
          <div className="text-3xl font-bold gradient-text">
            {36 - USER_PROGRESS.completedMilestones.length}
          </div>
          <div className="text-sm text-muted-foreground">Verbleibende Milestones</div>
        </div>
      </motion.div>
    </div>
  );
}


