import { Link } from "@solar-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Field } from "src/components/ui/label";
import { Switch } from "src/components/ui/switch";
import { toast } from "src/components/ui/toast";
import { useAppDispatch } from "src/store/store";
import { updateAgent } from "../common/agentsSlice";

import { useAgentDetailContext } from "../common/agentDetailContext";
import { tabVariants } from "../common/constants";

export function PublishPage() {
  const dispatch = useAppDispatch();
  const { id, isPublic, setIsPublic, publicPassword, setPublicPassword } = useAgentDetailContext();

  const [saving, setSaving] = useState(false);
  const [origPassword, setOrigPassword] = useState(publicPassword || "");

  // Sync original when agent data loads
  useEffect(() => {
    setOrigPassword(publicPassword || "");
  }, [id]);

  const dirty = (publicPassword || "") !== origPassword;

  const publicLink = `${window.location.origin}/chat/${id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success("Link copied!");
  };

  const handleTogglePublic = (checked: boolean) => {
    setIsPublic(checked);
    if (id) dispatch(updateAgent({ id, isPublic: checked }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await dispatch(updateAgent({ id, publicPassword: publicPassword || "" }));
      setOrigPassword(publicPassword || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div key="publish" variants={tabVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.18, ease: "easeInOut" }}>
          <div className="max-w-[600px] mx-auto px-6 py-8 flex flex-col gap-6">
            <div className="relative rounded-xl border bg-surface p-6 shadow-card">
              {/* Inner highlight line */}
              <div className="absolute top-0 left-8 right-8 h-px bg-linear-to-r from-transparent via-border to-transparent" />

              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-semibold text-main">Public Shareable Link</span>
                    <span className="text-[12px] text-muted">Allow anyone with the link to chat with this agent.</span>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={handleTogglePublic} />
                </div>

                {isPublic && (
                  <div className="flex flex-col gap-3 pl-0">
                    {/* Link display */}
                    <div className="flex items-center gap-2 bg-surface-raised px-3 py-2 rounded-lg border border-border">
                      <Link size={14} className="text-primary shrink-0" />
                      <a
                        href={publicLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-primary no-underline font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        {publicLink}
                      </a>
                      <Button size="sm" variant="secondary" onClick={handleCopyLink} className="shrink-0">
                        Copy
                      </Button>
                    </div>

                    {/* Password */}
                    <Field label="Access Password" optional>
                      <Input
                        type="text"
                        placeholder="Leave blank for open access"
                        value={publicPassword || ""}
                        onChange={(e) => setPublicPassword(e.target.value)}
                      />
                    </Field>
                    <p className="text-[11px] text-muted -mt-2">Guests must enter this password to access the chat.</p>

                    <div className="flex justify-end">
                      <Button size="sm" disabled={!dirty} loading={saving} onClick={handleSave}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
