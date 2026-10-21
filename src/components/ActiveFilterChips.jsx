import { activeFilterChips } from '../services/filters';

// Removable chips for every active filter, so it is clear why the list is shorter.
function ActiveFilterChips({ filters }) {
  const chips = activeFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <ul className='filter-chips' aria-label='Active filters'>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type='button'
            className='filter-chip'
            onClick={chip.remove}
            aria-label={`Remove filter ${chip.label}`}
          >
            <span>{chip.label}</span>
            <span aria-hidden='true' className='filter-chip-remove'>
              ×
            </span>
          </button>
        </li>
      ))}
      {chips.length > 1 ? (
        <li>
          <button type='button' className='filter-chip filter-chip-clear' onClick={filters.clear}>
            Clear all
          </button>
        </li>
      ) : null}
    </ul>
  );
}

export default ActiveFilterChips;
