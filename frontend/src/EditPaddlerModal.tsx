import { BADGES } from "./badges";

export interface EditForm {
  firstName: string;
  lastName: string;
  gender: 'kane' | 'wahine';
  type: 'racer' | 'casual' | 'very-casual';
  ability: number;
  seatPreference: string;
  badges: string[];
}

interface EditPaddlerModalProps {
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onSave: () => void;
  onClose: () => void;
}

function getAbilityColor(level: number): string {
  if (level >= 4) return '#22c55e';
  if (level >= 3) return '#f59e0b';
  return '#ef4444';
}

export function EditPaddlerModal({ editForm, setEditForm, onSave, onClose }: EditPaddlerModalProps) {
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 700 as const, color: '#717171', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,.12)',
    backgroundColor: '#ffffff',
    color: '#222222',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  };

  const toggleBtnStyle = (selected: boolean, activeColor: string, activeBg: string) => ({
    flex: 1,
    padding: '10px 12px',
    borderRadius: '8px',
    border: `2px solid ${selected ? activeColor : 'rgba(0,0,0,.12)'}`,
    backgroundColor: selected ? activeBg : '#ffffff',
    color: selected ? activeColor : '#717171',
    fontSize: '13px',
    fontWeight: 600 as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  });

  return (
    <div
      style={{
        // Cap the modal at the viewport height (minus a little headroom
        // for status/safe-area + the offset from the top), with the
        // white card inside doing its own internal scroll. Without this
        // cap, adding sections (e.g., the badges grid) pushes the action
        // bar below the fold on smaller phones — the Save button
        // disappears off the bottom of the screen.
        position: 'fixed', top: '80px', right: '20px', zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '8px',
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff', borderRadius: '16px',
          minWidth: '380px', maxWidth: '420px',
          boxShadow: '0 0 0 1px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06), 0 10px 28px rgba(0,0,0,.12)',
          // Flex column so the form area can grow to fill the card and
          // scroll on overflow while the header + action bar stay
          // pinned at the top and bottom of the card respectively.
          display: 'flex', flexDirection: 'column',
          maxHeight: '100%',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — pinned at the top of the card. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 12px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#222222', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            edit paddler
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#faf9f7', color: '#717171', border: 'none',
              cursor: 'pointer', fontSize: '14px', transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0efed'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#faf9f7'; }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable form area — fills the space between the header
            and the pinned action bar so long forms (now that badges
            are in the mix) don't push Save off-screen. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 24px 16px', overflowY: 'auto', flex: 1 }}>
          {/* Name fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>first name</label>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                style={inputStyle}
                placeholder="First name"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3387a2'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.12)'; }}
              />
            </div>
            <div>
              <label style={labelStyle}>last name</label>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                style={inputStyle}
                placeholder="Last name"
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3387a2'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.12)'; }}
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label style={labelStyle}>gender</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setEditForm(prev => ({ ...prev, gender: 'kane' }))}
                style={toggleBtnStyle(editForm.gender === 'kane', '#3b82f6', 'rgba(59,130,246,0.12)')}
              >
                <span>♂️</span> kane
              </button>
              <button
                onClick={() => setEditForm(prev => ({ ...prev, gender: 'wahine' }))}
                style={toggleBtnStyle(editForm.gender === 'wahine', '#ec4899', 'rgba(236,72,153,0.12)')}
              >
                <span>♀️</span> wahine
              </button>
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { id: 'racer' as const, label: 'racer', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
                { id: 'casual' as const, label: 'casual', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                { id: 'very-casual' as const, label: 'very casual', color: '#717171', bg: 'rgba(100,116,139,0.12)' },
              ]).map((option) => (
                <button
                  key={option.id}
                  onClick={() => setEditForm(prev => ({ ...prev, type: option.id }))}
                  style={toggleBtnStyle(editForm.type === option.id, option.color, option.bg)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ability */}
          <div>
            <label style={labelStyle}>ability <span style={{ color: '#b0b0b0', fontWeight: 400 }}>(1-5)</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((level) => {
                const isActive = editForm.ability === level;
                const color = getAbilityColor(level);
                return (
                  <button
                    key={level}
                    onClick={() => setEditForm(prev => ({ ...prev, ability: level }))}
                    style={{
                      width: '40px', height: '40px', borderRadius: '8px',
                      border: `2px solid ${isActive ? color : 'rgba(0,0,0,.12)'}`,
                      backgroundColor: isActive ? `${color}1a` : '#ffffff',
                      color: isActive ? color : '#717171',
                      fontSize: '14px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seat Preference */}
          <div>
            <label style={labelStyle}>seat preference <span style={{ color: '#b0b0b0', fontWeight: 400 }}>(click in priority order)</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6].map((seat) => {
                const prefs = editForm.seatPreference.split('').map(Number).filter(n => n > 0);
                const isSelected = prefs.includes(seat);
                const priority = prefs.indexOf(seat) + 1;
                return (
                  <button
                    key={seat}
                    onClick={() => {
                      const currentPrefs = editForm.seatPreference.split('').map(Number).filter(n => n > 0);
                      let newPrefs;
                      if (currentPrefs.includes(seat)) {
                        newPrefs = currentPrefs.filter(s => s !== seat);
                      } else {
                        newPrefs = [...currentPrefs, seat];
                      }
                      const prefString = [...newPrefs, ...Array(6 - newPrefs.length).fill(0)].join('').slice(0, 6);
                      setEditForm(prev => ({ ...prev, seatPreference: prefString }));
                    }}
                    style={{
                      width: '40px', height: '40px', borderRadius: '8px',
                      border: `2px solid ${isSelected ? '#f97316' : 'rgba(0,0,0,.12)'}`,
                      backgroundColor: isSelected ? 'rgba(249,115,22,0.12)' : '#ffffff',
                      color: isSelected ? '#f97316' : '#717171',
                      fontSize: '14px', fontWeight: 700,
                      cursor: 'pointer', position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {seat}
                    {isSelected && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: '#f97316', color: '#fff',
                        fontSize: '9px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {priority}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '12px', color: '#b0b0b0', marginTop: '4px' }}>
              Selected: {editForm.seatPreference.split('').map(Number).filter(n => n > 0).join(' > ') || 'None'}
            </p>
          </div>

          {/* Badges. Toggleable icon buttons; multi-select. The chosen
              ids are stored on the paddler and rendered as a prefix in
              every PaddlerChip. */}
          <div>
            <label style={labelStyle}>badges <span style={{ color: '#b0b0b0', fontWeight: 400 }}>(tap to toggle)</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {BADGES.map(b => {
                const isOn = editForm.badges.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    title={b.hint}
                    onClick={() => setEditForm(prev => ({
                      ...prev,
                      badges: isOn ? prev.badges.filter(x => x !== b.id) : [...prev.badges, b.id],
                    }))}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      border: `2px solid ${isOn ? '#005280' : 'rgba(0,0,0,.12)'}`,
                      backgroundColor: isOn ? 'rgba(0,82,128,0.10)' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, lineHeight: 1,
                      // Slight grayscale when off so the active set
                      // visually pops without changing layout.
                      filter: isOn ? 'none' : 'grayscale(0.4)',
                      opacity: isOn ? 1 : 0.7,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span aria-label={b.label}>{b.glyph}</span>
                  </button>
                );
              })}
            </div>
            {editForm.badges.length > 0 && (
              <p style={{ fontSize: '12px', color: '#b0b0b0', marginTop: '6px' }}>
                Selected: {editForm.badges.length} badge{editForm.badges.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>

        {/* Actions — pinned at the bottom of the card so Save/Cancel
            are always reachable regardless of form length. */}
        <div style={{ display: 'flex', gap: '12px', padding: '12px 24px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, backgroundColor: '#ffffff' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '8px',
              border: '1px solid rgba(0,0,0,.12)', backgroundColor: '#ffffff',
              color: '#717171', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,.12)'; }}
          >
            cancel
          </button>
          <button
            onClick={onSave}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '8px',
              border: 'none', backgroundColor: '#005280',
              color: '#ffffff', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.15s',
              boxShadow: '0 2px 8px rgba(0,82,128,0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            save changes
          </button>
        </div>
      </div>
    </div>
  );
}
