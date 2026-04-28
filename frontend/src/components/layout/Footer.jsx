import './Footer.css';
import { GITHUB_URL } from '../../config';

function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-content">
                <p>
                    Built by <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">SurGamingOnInsulin</a>
                </p>
                <p className="footer-date">&copy; {currentYear} Minecraft Panel</p>
            </div>
        </footer>
    );
}

export default Footer;
