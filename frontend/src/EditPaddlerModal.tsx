export interface EditForm {
  firstName: string;
  lastName: string;
  gender: 'kane' | 'wahine';
  type: 'racer' | 'casual' | 'very-casual';
  ability: number;
  seatPreference: string;
}

interface EditPaddlerModalProps {
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onSave: () => void;
  onClose: () => void;
}

export function EditPaddlerModal({ editForm, setEditForm, onSave, onClose }: EditPaddlerModalProps) {
  return (
    <div className="fixed flex" style={{
      top: '80px',
      right: '20px',
      zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: '16px',
      padding: '8px'
    }} onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', minWidth: '380px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1e293b' }}>
            <span>✏️</span> edit paddler
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>first name</label>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#1e293b' }}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#64748b' }}>last name</label>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#1e293b' }}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">gender</label>
            <div className="flex gap-2">
              {[
                { id: 'kane', label: 'kane', icon: '♂️', color: 'blue' },
                { id: 'wahine', label: 'wahine', icon: '♀️', color: 'pink' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setEditForm(prev => ({ ...prev, gender: option.id as 'kane' | 'wahine' }))}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-1.5
                    ${editForm.gender === option.id
                      ? option.color === 'blue'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-pink-500 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                >
                  <span>{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Type</label>
            <div className="flex gap-2">
              {[
                { id: 'racer', label: 'racer', color: 'violet' },
                { id: 'casual', label: 'casual', color: 'blue' },
                { id: 'very-casual', label: 'very casual', color: 'slate' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setEditForm(prev => ({ ...prev, type: option.id as 'racer' | 'casual' | 'very-casual' }))}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                    ${editForm.type === option.id
                      ? option.color === 'violet'
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                        : option.color === 'blue'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-slate-500 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ability */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Ability <span className="text-slate-400">(1-5)</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setEditForm(prev => ({ ...prev, ability: level }))}
                  className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all
                    ${editForm.ability === level
                      ? level >= 4
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : level >= 3
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Seat Preference */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Seat Preference <span className="text-slate-400">(click seats in priority order)</span>
            </label>
            <div className="flex gap-2">
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
                    className={`w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all relative
                      ${isSelected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                  >
                    {seat}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[8px] rounded-full flex items-center justify-center">
                        {priority}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Selected: {editForm.seatPreference.split('').map(Number).filter(n => n > 0).join(' > ') || 'None'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border font-medium transition-colors"
            style={{ borderColor: '#e2e8f0', color: '#64748b' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium shadow-lg"
            style={{ background: 'linear-gradient(to right, #3b82f6, #4f46e5)' }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
