/**
 * SolarIcon — lazy-resolve a @solar-icons/react component by name string.
 *
 * Usage:
 *   <SolarIcon name={tool.icon} size={20} weight="Outline" fallback={<Programming size={20} />} />
 *
 * - name: icon component name (e.g. "Programming", "Lock", "Cpu")
 * - If name is falsy or not found in the library, renders `fallback` (defaults to null).
 * - The solar module is loaded once and cached in a module-level variable.
 */

import type React from "react";
import { useEffect, useState } from "react";

// ─── Module-level cache ───────────────────────────────────────────────────────

let _solarModule: Record<string, React.ComponentType<any>> | null = null;
let _loadPromise: Promise<Record<string, React.ComponentType<any>>> | null = null;

function loadSolarModule(): Promise<Record<string, React.ComponentType<any>>> {
  if (_solarModule) return Promise.resolve(_solarModule);
  if (_loadPromise) return _loadPromise;
  _loadPromise = import("@solar-icons/react").then((mod) => {
    _solarModule = mod as unknown as Record<string, React.ComponentType<any>>;
    return _solarModule;
  });
  return _loadPromise;
}

function getSolarIcon(name: string): React.ComponentType<any> | null {
  return _solarModule?.[name] ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSolarIcon(name?: string | null): React.ComponentType<any> | null {
  const [Icon, setIcon] = useState<React.ComponentType<any> | null>(() => (name ? getSolarIcon(name) : null));

  useEffect(() => {
    if (!name) {
      setIcon(null);
      return;
    }
    if (_solarModule) {
      setIcon(() => getSolarIcon(name));
      return;
    }
    let cancelled = false;
    loadSolarModule().then((mod) => {
      if (!cancelled) setIcon(() => mod[name] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return Icon;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SolarIconProps {
  /** Icon component name from @solar-icons/react, e.g. "Programming" */
  name?: string | null;
  size?: number;
  weight?: "Bold" | "BoldDuotone" | "Linear" | "Outline";
  className?: string;
  /** Rendered when name is falsy or the icon is not found */
  fallback?: React.ReactNode;
}

export function SolarIcon({ name, size = 20, weight = "Outline", className, fallback = null }: SolarIconProps) {
  const Icon = useSolarIcon(name);

  if (!Icon) return <>{fallback}</>;
  return <Icon size={size} weight={weight} className={className} />;
}
