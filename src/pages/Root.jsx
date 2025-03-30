import InfoBar from '../components/InfoBar'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Outlet } from "react-router-dom";

function Root() {
	return (
        <div className='root-container'>
			<InfoBar />
			{/* <Navbar /> */}
            <div className='root-children-container'>
                <Outlet />
            </div>
            <Footer />
        </div>
	);
}

export default Root;
