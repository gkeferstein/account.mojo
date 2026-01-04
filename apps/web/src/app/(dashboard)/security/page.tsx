"use client";

import { motion } from "framer-motion";
import { UserProfile } from "@clerk/nextjs";
import { Shield } from "lucide-react";


export default function SecurityPage() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Sicherheit
        </h1>
        <p className="text-muted-foreground">
          Verwalte deine Sicherheitseinstellungen, Passwort und Zwei-Faktor-Authentifizierung.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card/50 border-border shadow-none",
              navbar: "hidden",
              pageScrollBox: "p-0",
              profilePage: "p-0",
              profileSection: "bg-card/50 rounded-xl border border-border p-6 mb-4",
              profileSectionTitle: "text-lg font-semibold",
              profileSectionContent: "mt-4",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              formFieldInput: "bg-secondary border-border",
            },
          }}
          routing="hash"
        />
      </motion.div>
    </>
  );
}
