import { AnimatePresence, motion } from "framer-motion";

import { useAgentDetailContext } from "../common/agentDetailContext";
import { tabVariants } from "../common/constants";
import { DangerZone } from "./components/DangerZone";

export function ConfigPage() {
  const { name, onDelete } = useAgentDetailContext();

  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div key="config" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18, ease: "easeInOut" }}>
          <div className="max-w-[600px] mx-auto px-6 py-8 flex flex-col gap-6">
            {/* ── Danger Zone ── */}
            <div className="relative rounded-xl border border-danger/20 bg-danger/5 p-6 pt-0 shadow-card">
              <DangerZone agentName={name} onDelete={onDelete} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
