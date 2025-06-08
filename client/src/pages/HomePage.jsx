import React from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      direction: 'rtl',
      textAlign: 'center',
      padding: '50px',
      background: 'linear-gradient(to bottom right, #0066cc, #33ccff)',
      height: '100vh',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '40px', marginBottom: '40px' }}>טורנירי כדורגל</h1>

      <button
        onClick={() => navigate('/login')}
        style={{
          padding: '15px 40px',
          fontSize: '20px',
          marginBottom: '20px',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: '#28a745',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        התחברות מנהל
      </button>
      <br />
      <button
        onClick={() => navigate('/view')}
        style={{
          padding: '15px 40px',
          fontSize: '20px',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: '#ffc107',
          color: '#333',
          cursor: 'pointer'
        }}
      >
        צפייה בטורניר לפי קוד
      </button>
    </div>
  );
}

export default HomePage;
