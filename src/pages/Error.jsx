import ErrorCmp from '../components/Error';
import { useDocumentTitle } from '../services/useDocumentTitle';

function Error({ msg }) {
  useDocumentTitle('Error');
  return (
    <div className='error-container'>
      <ErrorCmp msg={msg} />
    </div>
  );
}

export default Error;
