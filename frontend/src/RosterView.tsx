import { useState } from "react";
import type { Paddler } from "./types";
import { getAbilityColor } from "./utils";

interface RosterViewProps {
  paddlers: Paddler[];
  isAdmin: boolean;
  windowWidth: number;
  updatePaddler: (args: any) => void;
  toggleAdminMut: (args: { paddlerId: string }) => void;
  deleteUserByPaddlerIdMut: (args: { paddlerId: string }) => void;
  deletePaddlerMut: (args: { paddlerId: string }) => void;
  userEmailByPaddlerId: Map<string, string>;
  userRoleByPaddlerId: Map<string, string>;
}

export function RosterView({
  paddlers, isAdmin, windowWidth,
  updatePaddler, toggleAdminMut, deleteUserByPaddlerIdMut, deletePaddlerMut,
  userEmailByPaddlerId, userRoleByPaddlerId,
}: RosterViewProps) {
  const [editingSeatPrefId, setEditingSeatPrefId] = useState<string | null>(null);
  const [tempSeatPref, setTempSeatPref] = useState('000000');

  return (
    <div style={{ padding: '8px 0', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', minWidth: isAdmin ? '500px' : '280px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid rgba(0,0,0,.12)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600 }}>name</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600 }}>gender</th>
            {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600 }}>type</th>}
            {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600 }}>ability</th>}
            {isAdmin && <th style={{ textAlign: 'center', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600, minWidth: '70px' }}>seat pref</th>}
            {isAdmin && <th style={{ textAlign: 'center', padding: '8px 4px', color: '#717171', fontSize: '12px', fontWeight: 600, width: '40px' }}>adm</th>}
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#717171', fontSize: '12px', fontWeight: 600 }}>email</th>
            {isAdmin && <th style={{ width: '32px' }}></th>}
          </tr>
        </thead>
        <tbody>
          {[...paddlers].sort((a: Paddler, b: Paddler) => a.firstName.localeCompare(b.firstName)).map((p: Paddler) => (
            <tr key={p._id.toString()} style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <td style={{ padding: '8px 12px', color: '#484848', fontSize: '14px', fontWeight: 500 }}>
                {p.firstName} {p.lastName}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <span
                  onClick={isAdmin ? () => updatePaddler({ paddlerId: p.id, gender: p.gender === 'kane' ? 'wahine' : 'kane' }) : undefined}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '2px solid',
                    borderColor: p.gender === 'kane' ? '#3b82f6' : '#ec4899',
                    backgroundColor: p.gender === 'kane' ? 'rgba(59,130,246,0.15)' : 'rgba(236,72,153,0.15)',
                    color: p.gender === 'kane' ? '#60a5fa' : '#f472b6',
                    cursor: isAdmin ? 'pointer' : 'default',
                  }}
                >
                  {p.gender}
                </span>
              </td>
              {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {windowWidth < 768 ? (
                  <button
                    onClick={() => {
                      const types: Array<'racer' | 'casual' | 'very-casual'> = ['racer', 'casual', 'very-casual'];
                      const next = types[(types.indexOf(p.type) + 1) % 3];
                      updatePaddler({ paddlerId: p.id, type: next });
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                      border: '2px solid',
                      borderColor: p.type === 'racer' ? '#8b5cf6' : p.type === 'casual' ? '#3b82f6' : '#64748b',
                      backgroundColor: p.type === 'racer' ? 'rgba(139,92,246,0.15)' : p.type === 'casual' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                      color: p.type === 'racer' ? '#a78bfa' : p.type === 'casual' ? '#60a5fa' : '#b0b0b0',
                      cursor: 'pointer',
                    }}
                  >
                    {p.type === 'very-casual' ? 'v-casual' : p.type}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    {(['racer', 'casual', 'very-casual'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updatePaddler({ paddlerId: p.id, type: t })}
                        style={{
                          padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                          border: '2px solid',
                          borderColor: p.type === t
                            ? t === 'racer' ? '#8b5cf6' : t === 'casual' ? '#3b82f6' : '#64748b'
                            : 'transparent',
                          backgroundColor: p.type === t
                            ? t === 'racer' ? 'rgba(139,92,246,0.15)' : t === 'casual' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)'
                            : 'transparent',
                          color: p.type === t
                            ? t === 'racer' ? '#a78bfa' : t === 'casual' ? '#60a5fa' : '#b0b0b0'
                            : '#717171',
                          cursor: 'pointer',
                        }}
                      >
                        {t === 'very-casual' ? 'v-casual' : t}
                      </button>
                    ))}
                  </div>
                )}
              </td>}
              {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {windowWidth < 768 ? (() => {
                  const color = getAbilityColor(p.ability);
                  return (
                    <button
                      onClick={() => updatePaddler({ paddlerId: p.id, ability: (p.ability % 5) + 1 })}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        fontSize: '12px', fontWeight: 700, border: '2px solid',
                        borderColor: color, backgroundColor: `${color}26`, color,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {p.ability}
                    </button>
                  );
                })() : (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    {[1, 2, 3, 4, 5].map((level) => {
                      const isActive = p.ability === level;
                      const color = getAbilityColor(level);
                      return (
                        <button
                          key={level}
                          onClick={() => updatePaddler({ paddlerId: p.id, ability: level })}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            fontSize: '12px', fontWeight: 700, border: '2px solid',
                            borderColor: isActive ? color : 'transparent',
                            backgroundColor: isActive ? `${color}26` : 'transparent',
                            color: isActive ? color : '#717171',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                )}
              </td>}
              {isAdmin && <td style={{ padding: '8px 12px', textAlign: 'center', position: 'relative' }}>
                <span
                  onClick={() => { if (editingSeatPrefId !== p.id) { setEditingSeatPrefId(p.id); setTempSeatPref(p.seatPreference || '000000'); } }}
                  style={{ color: '#717171', fontSize: '13px', cursor: 'pointer', borderBottom: editingSeatPrefId === p.id ? 'none' : '1px dashed #4b5563', whiteSpace: 'nowrap' }}
                >
                  {p.seatPreference?.split('').map(Number).filter((n: number) => n > 0).join('') || '—'}
                </span>
                {editingSeatPrefId === p.id && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 30, backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04), 0 6px 18px rgba(0,0,0,.08)' }}>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {[1, 2, 3, 4, 5, 6].map((seat) => {
                        const prefs = tempSeatPref.split('').map(Number).filter(n => n > 0);
                        const isSelected = prefs.includes(seat);
                        const priority = prefs.indexOf(seat) + 1;
                        return (
                          <button
                            key={seat}
                            onClick={() => {
                              const currentPrefs = tempSeatPref.split('').map(Number).filter(n => n > 0);
                              let newPrefs;
                              if (currentPrefs.includes(seat)) {
                                newPrefs = currentPrefs.filter(s => s !== seat);
                              } else {
                                newPrefs = [...currentPrefs, seat];
                              }
                              setTempSeatPref([...newPrefs, ...Array(6 - newPrefs.length).fill(0)].join('').slice(0, 6));
                            }}
                            style={{
                              width: '20px', height: '20px', borderRadius: '4px',
                              fontSize: '10px', fontWeight: 700, border: '1.5px solid',
                              borderColor: isSelected ? '#f97316' : '#4b5563',
                              backgroundColor: isSelected ? 'rgba(249,115,22,0.15)' : 'transparent',
                              color: isSelected ? '#fb923c' : '#717171',
                              cursor: 'pointer', position: 'relative', padding: 0, lineHeight: 1,
                            }}
                          >
                            {seat}
                            {isSelected && (
                              <span style={{
                                position: 'absolute', top: '-3px', right: '-3px',
                                width: '10px', height: '10px', borderRadius: '50%',
                                backgroundColor: '#f97316', color: '#fff',
                                fontSize: '6px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {priority}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => setEditingSeatPrefId(null)}
                        style={{ padding: '1px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #4b5563', backgroundColor: 'transparent', color: '#717171', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => { updatePaddler({ paddlerId: p.id, seatPreference: tempSeatPref }); setEditingSeatPrefId(null); }}
                        style={{ padding: '1px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #3b82f6', backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                )}
              </td>}
              {isAdmin && <td style={{ padding: '8px 4px', textAlign: 'center', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={userRoleByPaddlerId.get(p.id) === 'admin'}
                  onChange={() => toggleAdminMut({ paddlerId: p.id })}
                  style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
                />
              </td>}
              <td style={{ padding: '8px 12px', color: '#717171', fontSize: '13px' }}>
                {userEmailByPaddlerId.get(p.id) || '—'}
              </td>
              {isAdmin && <td style={{ padding: '8px 4px', textAlign: 'center', width: '32px' }}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${p.firstName} ${p.lastName || p.lastInitial}? This removes their paddler profile and user account.`)) {
                      deleteUserByPaddlerIdMut({ paddlerId: p.id });
                      deletePaddlerMut({ paddlerId: p.id });
                    }
                  }}
                  style={{
                    background: 'none', border: 'none', color: '#717171', fontSize: '14px',
                    cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', lineHeight: 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#717171'; }}
                >
                  ✕
                </button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
