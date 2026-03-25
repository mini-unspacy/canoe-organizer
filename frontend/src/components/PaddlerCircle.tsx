import { useEffect, useRef } from "react";
import type { Paddler } from "../types";
import { getAbilityColor } from "../utils";

export const PaddlerCircle: React.FC<{ paddler: Paddler; isDragging?: boolean; animationKey?: number; animationDelay?: number; isAdmin?: boolean; variant?: 'boat' | 'sidebar' }> = ({ paddler, isDragging, animationKey = 0, animationDelay = 0, isAdmin }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animationKey === 0) return;
    const el = rowRef.current;
    if (!el) return;

    const anim = el.animate(
      [
        { transform: 'scale(0.3)', opacity: 0 },
        { transform: 'scale(1.08)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        delay: animationDelay,
        fill: 'backwards',
      }
    );

    return () => anim.cancel();
  }, [animationKey, animationDelay]);

  const genderTextColor = paddler.gender === 'kane' ? '#3b82f6' : '#ec4899';

  const firstName = paddler.firstName || '?';
  const lastName = paddler.lastName || paddler.lastInitial || '?';
  const displayName = `${firstName} ${lastName[0]?.toUpperCase() || ''}.`;

  const abilityGradient = getAbilityColor(paddler.ability);

  const fontSize = '18px';
  const badgeFs = '10px';

  const typeLetter = paddler.type === 'racer' ? 'R' : paddler.type === 'casual' ? 'C' : 'V';
  const typeColor = paddler.type === 'racer' ? '#8b5cf6' : paddler.type === 'casual' ? '#3b82f6' : '#64748b';

  return (
    <div
      ref={rowRef}
      className={`flex items-center flex-shrink-0
        ${isDragging ? 'opacity-80' : ''}
        cursor-grab active:cursor-grabbing`}
      style={{
        gap: '3px',
        padding: '0 2px',
        touchAction: 'manipulation',
        width: '100%',
        lineHeight: 1,
      }}
    >
      {isAdmin && (
        <>
          <span style={{
            fontSize: badgeFs, fontWeight: 800, color: '#fff', flexShrink: 0,
            backgroundColor: abilityGradient, borderRadius: '2px',
            padding: '0 2px', lineHeight: '1.3',
          }}>
            {paddler.ability}
          </span>
          <span style={{
            fontSize: badgeFs, fontWeight: 800, color: '#fff', flexShrink: 0,
            backgroundColor: typeColor, borderRadius: '2px',
            padding: '0 2px', lineHeight: '1.3',
          }}>
            {typeLetter}
          </span>
        </>
      )}
      <span style={{
        color: genderTextColor,
        fontSize,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {displayName}
      </span>
    </div>
  );
};

export const GuestPaddlerCircle: React.FC<{ paddler: Paddler; isDragging?: boolean; variant?: 'boat' | 'sidebar' }> = ({ paddler, isDragging }) => {
  const firstName = paddler.firstName;
  const lastName = paddler.lastName || paddler.lastInitial || '';
  const displayName = `${firstName} ${lastName[0]?.toUpperCase() || ''}.`;
  const fontSize = '18px';
  const badgeFs = '10px';

  return (
    <div
      className={`flex items-center flex-shrink-0
        ${isDragging ? 'opacity-80' : ''}
        cursor-grab active:cursor-grabbing`}
      style={{
        gap: '3px',
        padding: '0 2px',
        touchAction: 'manipulation',
        width: '100%',
        lineHeight: 1,
      }}
    >
      <span style={{
        fontSize: badgeFs, fontWeight: 800, color: '#fff', flexShrink: 0,
        backgroundColor: '#f59e0b', borderRadius: '2px',
        padding: '0 2px', lineHeight: '1.3',
      }}>
        G
      </span>
      <span style={{
        color: '#fbbf24',
        fontSize,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {displayName}
      </span>
    </div>
  );
};
