import InfoBar from '../components/InfoBar'
import Footer from '../components/Footer'
import { Outlet } from "react-router-dom";

function Root() {
	return (
        <div className='root-container'>
			<InfoBar />
            <div className='root-children-container'>
                <Outlet />
            </div>
            <Footer />
        </div>
	);
}

export default Root;
