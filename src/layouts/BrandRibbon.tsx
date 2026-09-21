/** The six brand values, in the order the identity presents them. */
const BRAND_RIBBON = [
  "bg-supera-uniao",
  "bg-supera-empatia",
  "bg-supera-seguranca",
  "bg-supera-respeito",
  "bg-supera-perfeicao",
  "bg-supera-amor",
] as const;

/** Thin strip in the brand colours that opens every public page. Decorative only. */
export function BrandRibbon() {
  return (
    <div className="flex h-1.5 w-full" aria-hidden="true">
      {BRAND_RIBBON.map((color) => (
        <span key={color} className={`${color} flex-1`} />
      ))}
    </div>
  );
}
