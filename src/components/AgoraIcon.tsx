export function AgoraIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
    >
      <rect width="120" height="120" rx="24" fill="#4EA888" />
      {/* frontão */}
      <polygon points="60,13 97,30 23,30" fill="#FAFAF0" />
      {/* friso */}
      <rect x="23" y="30" width="74" height="5" fill="#FAFAF0" />
      <rect x="23" y="30" width="74" height="5" fill="#3A9478" opacity=".15" />
      {/* 6 colunas */}
      <rect x="27" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="26" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="26" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="39" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="38" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="38" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="51" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="50" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="50" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="63" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="62" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="62" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="75" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="74" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="74" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="87" y="35" width="7" height="28" rx="1.5" fill="#FAFAF0" />
      <rect x="86" y="35" width="9" height="2.5" fill="#FAFAF0" />
      <rect x="86" y="60.5" width="9" height="2.5" fill="#FAFAF0" />
      {/* estilobate */}
      <rect x="22" y="63" width="76" height="4" fill="#FAFAF0" />
      <rect x="18" y="67" width="84" height="3.5" fill="#FAFAF0" opacity=".85" />
      <rect x="13" y="70.5" width="94" height="3" fill="#FAFAF0" opacity=".65" />
      {/* linha d'água */}
      <rect x="8" y="75" width="104" height="2.5" fill="#E8A848" />
      {/* reflexo */}
      <rect x="22" y="79" width="76" height="3" fill="#FAFAF0" opacity=".3" />
      <rect x="27" y="84" width="66" height="2.5" fill="#FAFAF0" opacity=".2" />
      <rect x="28" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="40" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="52" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="64" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="76" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="88" y="84" width="7" height="14" fill="#FAFAF0" opacity=".12" />
      <rect x="27" y="98" width="66" height="2" fill="#FAFAF0" opacity=".1" />
      <rect x="32" y="102" width="56" height="1.5" fill="#FAFAF0" opacity=".06" />
    </svg>
  );
}
