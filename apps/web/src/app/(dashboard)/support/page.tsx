"use client";

import { motion } from "framer-motion";
import {
  HelpCircle,
  MessageCircle,
  Mail,
  ExternalLink,
  BookOpen,
  Video,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const supportLinks = [
  {
    title: "Wissensdatenbank",
    description: "Anleitungen und FAQ zu allen Funktionen",
    icon: BookOpen,
    href: "https://help.mojo-institut.de",
  },
  {
    title: "Video-Tutorials",
    description: "Schritt-für-Schritt Videoanleitungen",
    icon: Video,
    href: "https://campus.mojo-institut.de/tutorials",
  },
  {
    title: "Community",
    description: "Austausch mit anderen MOJO-Nutzern",
    icon: MessageCircle,
    href: "https://community.mojo-institut.de",
  },
];

export default function SupportPage() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">Hilfe & Support</h1>
        <p className="text-muted-foreground">
          Finde Antworten auf deine Fragen oder kontaktiere unser Support-Team.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {supportLinks.map((link, index) => (
          <motion.a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
          >
            <Card className="bg-card/50 h-full card-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <link.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  {link.title}
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
              </CardContent>
            </Card>
          </motion.a>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Kontakt aufnehmen
            </CardTitle>
            <CardDescription>
              Du hast eine Frage, die in unserer Wissensdatenbank nicht beantwortet wird?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-lg bg-secondary/50">
                <h4 className="font-semibold mb-2">E-Mail Support</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Unser Support-Team antwortet in der Regel innerhalb von 24 Stunden.
                </p>
                <Button asChild>
                  <a href="mailto:support@mojo-institut.de">
                    <Mail className="w-4 h-4 mr-2" />
                    support@mojo-institut.de
                  </a>
                </Button>
              </div>

              <div className="p-6 rounded-lg bg-secondary/50">
                <h4 className="font-semibold mb-2">Live-Chat</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Für schnelle Antworten während unserer Geschäftszeiten.
                </p>
                <Button variant="outline" disabled>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat starten (bald verfügbar)
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-primary">Premium Support</h4>
                  <p className="text-sm text-muted-foreground">
                    Mit einem MOJO Premium Abonnement erhältst du Zugang zu priorisiertem
                    Support und direkten Ansprechpartnern.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
