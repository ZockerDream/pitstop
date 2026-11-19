import type { AppData, CollectionKey, CompanySettings, ContactPerson } from '../../shared/types';

// Der Reducer kennt keine Fachlogik: Er übernimmt nur, was die API zurückgibt.

export type StoreAction =
  | { type: 'loaded'; data: AppData }
  | { type: 'upsert'; collection: CollectionKey; item: { id: string } }
  | { type: 'remove'; collection: CollectionKey; id: string }
  | { type: 'contacts/replace'; customerId: string; contacts: ContactPerson[] }
  | { type: 'company'; company: CompanySettings };

export function reducer(state: AppData | null, action: StoreAction): AppData | null {
  if (action.type === 'loaded') return action.data;
  if (!state) return state;
  switch (action.type) {
    case 'upsert': {
      const list = state[action.collection] as { id: string }[];
      const index = list.findIndex((x) => x.id === action.item.id);
      const next = index >= 0 ? list.map((x, i) => (i === index ? action.item : x)) : [action.item, ...list];
      const updated = { ...state, [action.collection]: next } as AppData;
      if (action.collection === 'users' && action.item.id === state.me.id) updated.me = action.item as AppData['me'];
      return updated;
    }
    case 'remove': {
      const list = state[action.collection] as { id: string }[];
      return { ...state, [action.collection]: list.filter((x) => x.id !== action.id) } as AppData;
    }
    case 'contacts/replace':
      return { ...state, contacts: [...state.contacts.filter((c) => c.customerId !== action.customerId), ...action.contacts] };
    case 'company':
      return { ...state, company: action.company };
  }
}
