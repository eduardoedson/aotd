import ErrorCmp from '../components/Error';
import { useDocumentTitle } from '../services/useDocumentTitle';

function Error({ title, msg, children }) {
  useDocumentTitle('Error');
  return (
    <div className='error-container'>
      <ErrorCmp title={title} msg={msg}>
        {children}
      </ErrorCmp>
    </div>
  );
}

export default Error;
