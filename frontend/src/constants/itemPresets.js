/**
 * Standard Presets for SEENta (PUP Biñan Campus)
 */

export const ITEM_CATEGORIES = [
  'Electronics & Gadgets',
  'IDs & Academic Documents',
  'Wallets, Purses & Cash',
  'Keys & Keycards',
  'Tumblers & Water Bottles',
  'Clothing, Uniforms & Accessories',
  'Books, Notebooks & Stationery',
  'Other Belongings'
];

export const CAMPUS_LOCATION_GROUPS = [
  {
    branch: 'CITE',
    customValue: 'CITE_CUSTOM',
    customLabel: 'Custom Location (Locations strictly within the CITE Campus)',
    customPlaceholder: 'Type exact spot strictly within CITE Campus (e.g. Computer Lab 2, Room 304)...',
    locations: [
      { value: 'CITE — Campus Canteen', label: 'Campus Canteen' },
      { value: 'CITE — Basketball Court', label: 'Basketball Court' },
      { value: 'CITE — Guard Post', label: 'Guard Post' },
      { value: 'CITE — 1st Floor Hallway', label: '1st Floor Hallway' },
      { value: 'CITE — 2nd Floor Hallway', label: '2nd Floor Hallway' },
      { value: 'CITE — 3rd Floor Hallway', label: '3rd Floor Hallway' },
      { value: 'CITE — 4th Floor Hallway', label: '4th Floor Hallway' },
      { value: 'CITE — Parking Lot', label: 'Parking Lot' },
      { value: 'CITE — Campus Library (3rd Floor)', label: 'Campus Library (3rd Floor)' }
    ]
  },
  {
    branch: 'Main Campus',
    customValue: 'MAIN_CUSTOM',
    customLabel: 'Custom Location (Locations strictly within the Main Campus)',
    customPlaceholder: 'Type exact spot strictly within Main Campus (e.g. Registrar, Old Bldg Room 102)...',
    locations: [
      { value: 'Main Campus — Canteen Lobby', label: 'Canteen Lobby' },
      { value: 'Main Campus — Guard Post', label: 'Guard Post' },
      { value: 'Main Campus — Quadrangle', label: 'Campus Quadrangle' },
      { value: 'Main Campus — Park Garden', label: 'Campus Park Garden' },
      { value: 'Main Campus — New Building 1st Floor Hallway', label: 'New Building 1st Floor Hallway' },
      { value: 'Main Campus — New Building 2nd Floor Hallway', label: 'New Building 2nd Floor Hallway' },
      { value: 'Main Campus — New Building 3rd Floor Hallway', label: 'New Building 3rd Floor Hallway' },
      { value: 'Main Campus — New Building 4th Floor Hallway', label: 'New Building 4th Floor Hallway' },
      { value: 'Main Campus — Old Building 1st Floor Hallway', label: 'Old Building 1st Floor Hallway' },
      { value: 'Main Campus — Old Building 2nd Floor Hallway', label: 'Old Building 2nd Floor Hallway' },
      { value: 'Main Campus — Old Building 3rd Floor Hallway', label: 'Old Building 3rd Floor Hallway' },
      { value: 'Main Campus — Old Building 4th Floor Hallway', label: 'Old Building 4th Floor Hallway' }
    ]
  }
];

export const CAMPUS_LOCATIONS = [
  ...CAMPUS_LOCATION_GROUPS.flatMap((group) => group.locations.map((loc) => loc.value)),
  'Other / Custom Location'
];

export function isCustomLocationPreset(value) {
  return value === 'CITE_CUSTOM' || value === 'MAIN_CUSTOM' || value === 'Other / Custom Location';
}

export function getCustomLocationPlaceholder(value) {
  const matched = CAMPUS_LOCATION_GROUPS.find((g) => g.customValue === value);
  return matched ? matched.customPlaceholder : 'Specify exact campus location...';
}

export function resolveLocationValue(locationPreset, customLocation) {
  const trimmed = (customLocation || '').trim();
  if (!isCustomLocationPreset(locationPreset)) return locationPreset;
  if (!trimmed) return '';
  if (locationPreset === 'CITE_CUSTOM') {
    return trimmed.toLowerCase().includes('cite') ? trimmed : `CITE — ${trimmed}`;
  }
  if (locationPreset === 'MAIN_CUSTOM') {
    return trimmed.toLowerCase().includes('main') ? trimmed : `Main Campus — ${trimmed}`;
  }
  return trimmed;
}

export const ITEM_CONDITIONS = [
  { value: 'New', label: 'Like New (Flawless condition)' },
  { value: 'Good', label: 'Good (Minor normal wear)' },
  { value: 'Fair', label: 'Fair (Visible scratches or marks)' },
  { value: 'Damaged', label: 'Damaged (Needs repair or broken)' }
];
