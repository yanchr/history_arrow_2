import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Header.css'

function Header() {
  const { user, signOut, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <svg
            className="logo-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span className="logo-text">History Arrow</span>
        </Link>

        <nav className="header-nav">
          <Link to="/" className="nav-link">Timeline</Link>
          {isAuthenticated ? (
            <>
              <Link to="/admin" className="nav-link">Dashboard</Link>
              <div className="nav-user">
                <span className="user-email">{user?.email}</span>
                <button onClick={handleSignOut} className="btn btn-secondary btn-sm">
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Admin Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
