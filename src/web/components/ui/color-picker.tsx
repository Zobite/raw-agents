import { useRef } from "react";

// ─── ColorPicker ──────────────────────────────────────────────────────────────
// Preset swatches + custom color wheel for dark neon theme.

interface ColorPickerProps {
  presets: readonly string[];
  value: string;
  onChange: (color: string) => void;
  size?: number;
}

export function ColorPicker({ presets, value, onChange, size = 28 }: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = !presets.includes(value);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map((preset) => {
        const isActive = value === preset;
        return (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className="rounded-lg cursor-pointer transition-all duration-150 hover:scale-110 focus-visible:outline-none"
            style={{
              width: size,
              height: size,
              backgroundColor: preset,
              border: isActive ? "2px solid #A8FF53" : "2px solid transparent",
              boxShadow: isActive ? "0 0 0 2px rgba(168,255,83,0.3), inset 0 1px 2px rgba(0,0,0,0.3)" : "inset 0 1px 2px rgba(0,0,0,0.2)",
            }}
            title={preset}
          />
        );
      })}

      <label
        className="relative rounded-lg cursor-pointer transition-all duration-150 hover:scale-110 overflow-hidden"
        style={{
          width: size,
          height: size,
          border: isCustom ? "2px solid #A8FF53" : "2px solid transparent",
          boxShadow: isCustom ? "0 0 0 2px rgba(168,255,83,0.3)" : "inset 0 1px 2px rgba(0,0,0,0.2)",
        }}
        title="Custom color"
      >
        <div className="absolute inset-0" style={{ background: "conic-gradient(#e88080, #e8c870, #80d4a0, #70c8d8, #7aaee8, #a888e8, #e88080)" }} />
        {isCustom && <div className="absolute inset-[4px] rounded-[4px]" style={{ backgroundColor: value }} />}
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </label>
    </div>
  );
}

export type { ColorPickerProps };
