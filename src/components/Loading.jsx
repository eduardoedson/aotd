import LoadingImg from '../assets/images/loading.svg';

function Loading({ label = 'Loading' }) {
  return (
    <div className='loading-container' role='status'>
      <img src={LoadingImg} alt={label} />
    </div>
  );
}

export default Loading;
