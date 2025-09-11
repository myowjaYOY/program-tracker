'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

export default function DebugUserPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makingAdmin, setMakingAdmin] = useState(false);

  const fetchUserInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/debug/user-info');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user info');
      }
      
      setUserInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const makeAdmin = async () => {
    setMakingAdmin(true);
    setError(null);
    try {
      const response = await fetch('/api/debug/make-admin', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to make user admin');
      }
      
      alert('Successfully made admin! Refreshing user info...');
      await fetchUserInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setMakingAdmin(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Debug User Info
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={fetchUserInfo}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh User Info'}
        </Button>
        
        {userInfo && !userInfo.isAdmin && (
          <Button 
            variant="contained" 
            color="warning"
            onClick={makeAdmin}
            disabled={makingAdmin}
          >
            {makingAdmin ? 'Making Admin...' : 'Make Me Admin'}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {userInfo && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Session User:
          </Typography>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(userInfo.sessionUser, null, 2)}
          </pre>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Database User:
          </Typography>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
            {JSON.stringify(userInfo.dbUser, null, 2)}
          </pre>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Is Admin: {userInfo.isAdmin ? 'YES' : 'NO'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
