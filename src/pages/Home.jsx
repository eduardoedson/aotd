import { useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import Calendar from '../components/Calendar';
import { formatLongDate, isValidDate } from '../services/globals';
import { useDocumentTitle } from '../services/useDocumentTitle';

function Home() {
  const { date } = useParams();
  useDocumentTitle(isValidDate(date) ? formatLongDate(date) : 'Invalid date');

  return (
    <div className='home-container'>
      <Logo />
      <header className='home-intro'>
        <span className='home-intro-eyebrow'>Your daily anime schedule</span>
        <h1>Never miss the next episode.</h1>
        <p>Browse what is airing today or jump to any date.</p>
      </header>
      <Calendar />
    </div>
  );
}

export default Home;
