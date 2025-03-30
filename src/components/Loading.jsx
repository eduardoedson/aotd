import LoadingImg from '../assets/images/loading.svg';

function Loading () {
    return <div className='loading-container'><img src={LoadingImg} alt="Loading" /></div>;
}

export default Loading;