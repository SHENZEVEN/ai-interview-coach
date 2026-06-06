import { useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import QuickPractice from "@/views/QuickPractice";
import TargetedPractice from "@/views/TargetedPractice";
import History from "@/views/History";
import QuestionBank from "@/views/QuestionBank";
import ResumeRoast from "@/views/ResumeRoast";
import '../../styles/Layout.css';

const RouterView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('zh-CN'));

  useEffect(() => {
    // 开机动画 - 3秒完成
    const totalPixels = 20;
    const intervalTime = 3000 / totalPixels; // 3秒 / 20个像素
    let currentPixel = 0;
    
    const bootInterval = setInterval(() => {
      currentPixel++;
      setBootProgress(currentPixel);
      
      if (currentPixel >= totalPixels) {
        clearInterval(bootInterval);
        setTimeout(() => setIsBooting(false), 200);
      }
    }, intervalTime);

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

  useEffect(() => {
    // 实时更新时间
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('zh-CN'));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getActiveTab = () => {
    if (location.pathname === '/targeted') return 'targeted';
    if (location.pathname === '/history') return 'history';
    if (location.pathname === '/questionbank') return 'questionbank';
    if (location.pathname === '/roast') return 'roast';
    return 'quick';
  };

  const tabs = [
    { key: 'quick', label: '快速练习', path: '/quick' },
    { key: 'targeted', label: '针对性练习', path: '/targeted' },
    { key: 'questionbank', label: '题库', path: '/questionbank' },
    { key: 'roast', label: '简历拷打', path: '/roast' },
    { key: 'history', label: '历史记录', path: '/history' },
  ];

  const getContent = () => {
    switch (location.pathname) {
      case '/targeted':
        return <TargetedPractice />;
      case '/history':
        return <History />;
      case '/questionbank':
        return <QuestionBank />;
      case '/roast':
        return <ResumeRoast />;
      default:
        return <QuickPractice />;
    }
  };

  return (
    <div className="crt-container">
      {/* 老式电脑显示器外壳 */}
      <div className="crt">
        {/* CRT顶部状态栏 - 与底部按钮区域对称 */}
        <div className="crt-top-bar">
          <div className="crt-top-left">
            <span className="crt-icon">▮▮</span>
            <span className="crt-system">AI-TERMINAL</span>
          </div>
          <div className="crt-top-center">
            <span className="crt-time">{currentTime}</span>
          </div>
          <div className="crt-top-right">
            <span className="crt-status online">ONLINE</span>
          </div>
        </div>
        
        {/* CRT显示器屏幕区域 */}
        <div className="crt-frame">
          {/* 开机动画 */}
          {isBooting && (
            <div className="boot-screen">
              <div className="boot-animation">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className={`boot-pixel ${i < bootProgress ? 'active' : ''}`}
                  />
                ))}
              </div>
              <div className="boot-text">System Initializing...</div>
            </div>
          )}
          
          {/* 屏幕内框 */}
          <div className="crt-screen">
            {/* 扫描线效果 */}
            <div className="crt-scanlines" />
            
            {/* 原有内容 */}
            <div className="layout">
              <main className="main-content">
              <div className="status-bar">&gt; SYSTEM READY</div>
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
                {getContent()}
              </div>
            </main>
            </div>
          </div>
        </div>
        
        {/* 物理按钮区域 */}
        <div className="crt-controls">
          <div className="crt-indicator" />
          <div className="crt-buttons">
            <button className="crt-button power" title="Power" />
            <button className="crt-button" title="Menu" />
            <button className="crt-button" title="Brightness" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouterView;