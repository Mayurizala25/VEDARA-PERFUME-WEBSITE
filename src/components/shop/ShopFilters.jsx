import Button from '../ui/Button';
import { formatPrice } from '../../lib/format';
import styles from './ShopFilters.module.css';

const SIZE_OPTIONS = ['30ml', '50ml', '100ml'];
const RATING_OPTIONS = [
  { value: 0, label: 'All ratings' },
  { value: 4.5, label: '4.5 & up' },
  { value: 4, label: '4.0 & up' },
  { value: 3.5, label: '3.5 & up' },
];

/**
 * ShopFilters — the full filter panel, shared by the desktop sidebar and the
 * mobile drawer. Fully controlled: `value` holds every filter, `onChange`
 * receives a partial patch. Every group combines with the others (AND);
 * multi-select groups match any of the chosen values (OR).
 */
export default function ShopFilters({
  value,
  onChange,
  genders,
  familyOptions,
  typeOptions,
  priceBounds,
  resultCount,
  onReset,
}) {
  const patch = (next) => onChange(next);

  const toggleInArray = (key, item) => {
    const current = value[key];
    patch({ [key]: current.includes(item) ? current.filter((v) => v !== item) : [...current, item] });
  };

  const [minBound, maxBound] = priceBounds;
  const [minPrice, maxPrice] = value.price;
  const span = maxBound - minBound || 1;

  const setMinPrice = (raw) => {
    const next = Math.min(Number(raw), maxPrice - 100);
    patch({ price: [Math.max(minBound, next), maxPrice] });
  };
  const setMaxPrice = (raw) => {
    const next = Math.max(Number(raw), minPrice + 100);
    patch({ price: [minPrice, Math.min(maxBound, next)] });
  };

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend>Shopping for</legend>
        <div className={styles.radioList}>
          {genders.map((gender) => (
            <label key={gender} className={styles.radio}>
              <input
                type="radio"
                name="shop-gender"
                checked={value.gender === gender}
                onChange={() => patch({ gender })}
              />
              <span>{gender}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Fragrance family</legend>
        <div className={styles.checkList}>
          {familyOptions.map((family) => (
            <label key={family} className={styles.check}>
              <input
                type="checkbox"
                checked={value.families.includes(family)}
                onChange={() => toggleInArray('families', family)}
              />
              <span>{family}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Concentration</legend>
        <div className={styles.checkList}>
          {typeOptions.map((type) => (
            <label key={type} className={styles.check}>
              <input
                type="checkbox"
                checked={value.types.includes(type)}
                onChange={() => toggleInArray('types', type)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Price</legend>
        <div className={styles.priceValues}>
          <span>{formatPrice(minPrice)}</span>
          <span>{formatPrice(maxPrice)}</span>
        </div>
        <div className={styles.range}>
          <div
            className={styles.rangeFill}
            style={{
              left: `${((minPrice - minBound) / span) * 100}%`,
              right: `${100 - ((maxPrice - minBound) / span) * 100}%`,
            }}
          />
          <input
            type="range"
            min={minBound}
            max={maxBound}
            step={100}
            value={minPrice}
            aria-label="Minimum price"
            onChange={(event) => setMinPrice(event.target.value)}
          />
          <input
            type="range"
            min={minBound}
            max={maxBound}
            step={100}
            value={maxPrice}
            aria-label="Maximum price"
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Size</legend>
        <div className={styles.pills}>
          {SIZE_OPTIONS.map((size) => (
            <label key={size} className={styles.pill} data-active={value.sizes.includes(size) || undefined}>
              <input
                type="checkbox"
                checked={value.sizes.includes(size)}
                onChange={() => toggleInArray('sizes', size)}
              />
              <span>{size}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Rating</legend>
        <div className={styles.radioList}>
          {RATING_OPTIONS.map((option) => (
            <label key={option.value} className={styles.radio}>
              <input
                type="radio"
                name="shop-rating"
                checked={value.minRating === option.value}
                onChange={() => patch({ minRating: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Availability</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.inStockOnly}
            onChange={(event) => patch({ inStockOnly: event.target.checked })}
          />
          <span>In stock only</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.bestSellerOnly}
            onChange={(event) => patch({ bestSellerOnly: event.target.checked })}
          />
          <span>Best sellers</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.newArrivalOnly}
            onChange={(event) => patch({ newArrivalOnly: event.target.checked })}
          />
          <span>New arrivals</span>
        </label>
      </fieldset>

      <Button type="button" variant="secondary" size="sm" className={styles.reset} onClick={onReset}>
        Clear all filters
      </Button>
      <p className={styles.count}>{resultCount} {resultCount === 1 ? 'fragrance' : 'fragrances'}</p>
    </div>
  );
}
