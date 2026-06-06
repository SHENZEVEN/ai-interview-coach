import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import '../styles/Layout.css';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);

  useEffect(() => {
    // 开机动画
    const bootInterval = setInterval(() => {
      setBootProgress(prev => {
        if (prev >= 100) {
          clearInterval(bootInterval);
          setTimeout(() => setIsBooting(false), 300);
          return 100;
        }
        return prev + 5;
      });
    }, 50);

    // 清理：如果已经看过开机动画，下次不再显示
    const hasBooted = sessionStorage.getItem('hasBooted');
    if (hasBooted) {
      setIsBooting(false);
      clearInterval(bootInterval);
    } else {
      sessionStorage.setItem('hasBooted', 'true');
    }

    return () => clearInterval(bootInterval);
  }, []);

  const getActiveTab = () => {
    if (location.pathname === '/targeted') return 'targeted';
    if (location.pathname === '/history') return 'history';
    return 'quick';
  };

  const tabs = [
    { key: 'quick', label: '快速练习', path: '/quick' },
    { key: 'targeted', label: '针对性练习', path: '/targeted' },
    { key: 'history', label: '历史记录', path: '/history' },
  ];

  return (
    <div className="crt-container">
      {/* 开机动画 */}
      {isBooting && (
        <div className="boot-screen">
          <div className="boot-animation">
            <div className="boot-line" style={{ width: `${bootProgress}%` }} />
          </div>
          <div className="boot-text">SYSTEM INITIALIZING...</div>
        </div>
      )}
      
      {/* CRT显示器外壳 */}
      <div className="crt">
        {/* CRT顶部状态栏 */}
        <div className="crt-top-bar">
          <div className="crt-top-left">
            <span className="crt-icon">●</span>
            <span className="crt-system">AI INTERVIEW SYSTEM</span>
          </div>
          <div className="crt-top-center">v1.0</div>
          <div className="crt-top-right">
            <span className="crt-status online">ONLINE</span>
          </div>
        </div>

        {/* CRT显示器外框 */}
        <div className="crt-frame">
          {/* 屏幕内框 */}
          <div className="crt-screen">
            {/* 扫描线效果 */}
            <div className="crt-scanlines" />
            
            {/* 原有内容 */}
            <div className="layout">
              <header className="header">
                <div className="header-content">
                  <h1 className="header-title">AI 面试模拟器</h1>
                </div>
              </header>
              <main className="main-content">
                <nav className="nav-tabs">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`nav-tab ${getActiveTab() === tab.key ? 'active' : ''}`}
                      onClick={() => navigate(tab.path)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="page-container">
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
        </div>

        {/* CRT底部物理按钮区域 */}
        <div className="crt-controls">
          <div className="crt-buttons">
            <button className="crt-button power" />
            <button className="crt-button" />
            <button className="crt-button" />
          </div>
          <div className="crt-indicator" />
          <div className="crt-brand">AI INTERVIEW SYSTEM</div>
        </div>
      </div>
    </div>
  );
};

export default Layout;