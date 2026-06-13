// State + district options (mirrors the app's location picker) for admin dropdowns.
export const STATES = ['Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka'];

export const DISTRICTS: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Krishna', 'Guntur', 'West Godavari', 'East Godavari', 'Prakasam', 'Nellore',
    'Kurnool', 'Kadapa', 'Anantapur', 'Chittoor', 'Visakhapatnam', 'Vizianagaram', 'Srikakulam',
  ],
  'Telangana': [
    'Hyderabad', 'Rangareddy', 'Medchal', 'Nalgonda', 'Warangal', 'Khammam',
    'Karimnagar', 'Nizamabad', 'Mahbubnagar', 'Adilabad',
  ],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'],
  'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Belagavi', 'Ballari', 'Kalaburagi'],
};

export function districtsFor(state: string): string[] {
  return DISTRICTS[state] ?? [];
}
