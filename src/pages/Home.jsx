import Logo from '../components/Logo';
import Calendar from '../components/Calendar';

function Home() {
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
