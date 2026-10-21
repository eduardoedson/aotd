import { Link, useLocation } from 'react-router-dom';
import { useFavorites } from '../services/favorites';
import { useHistory } from '../services/history';
import { useWatched } from '../services/watched';
import { getToday } from '../services/globals';
import { useTimeZone } from '../services/timezone';
import { useDocumentTitle } from '../services/useDocumentTitle';

function LibraryCard({ item, subtitle, date }) {
  return (
    <Link className='library-card' to={`/${date}/${item.id}`}>
      {item.image ? (
        <img src={item.image} alt='' loading='lazy' />
      ) : (
        <div className='library-placeholder' />
      )}
      <span>
        <strong>{item.title}</strong>
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}

function Library() {
  useDocumentTitle('My library');
  const { favorites } = useFavorites();
  const history = useHistory();
  const { watched } = useWatched();
  const timeZone = useTimeZone();
  const today = getToday(timeZone);
  const { search } = useLocation();
  const favoriteItems = Object.values(favorites).sort(
    (a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0),
  );
  return (
    <div className='library-page'>
      <header className='library-header'>
        <Link to={`/${today}${search}`}>← Back to schedule</Link>
        <span>YOUR COLLECTION</span>
        <h1>My library</h1>
        <p>
          Favorites, watching progress and recently viewed titles — saved privately in this browser.
        </p>
      </header>
      <section>
        <h2>
          Favorites <span>{favoriteItems.length}</span>
        </h2>
        <div className='library-grid'>
          {favoriteItems.length ? (
            favoriteItems.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                date={today}
                subtitle={
                  watched[item.id] ? `Watched through episode ${watched[item.id]}` : 'Not started'
                }
              />
            ))
          ) : (
            <p className='library-empty'>No favorites yet. Use the heart on any card.</p>
          )}
        </div>
      </section>
      <section>
        <h2>
          Recently viewed <span>{history.length}</span>
        </h2>
        <div className='library-grid'>
          {history.length ? (
            history.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                date={item.date}
                subtitle={`Viewed ${new Date(item.viewedAt).toLocaleDateString()}`}
              />
            ))
          ) : (
            <p className='library-empty'>Your viewing history will appear here.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default Library;
