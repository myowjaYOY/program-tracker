'use client';

import React, { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Fab,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useActiveNotifications, Notification } from '@/lib/hooks/use-notifications';
import NotificationDetailModal from './notification-detail-modal';

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return <ErrorIcon color="error" />;
    case 'high':
      return <WarningIcon color="warning" />;
    default:
      return <InfoIcon color="info" />;
  }
};

const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' => {
  switch (priority) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    default:
      return 'info';
  }
};

const getHighestPriority = (notifications: Notification[]): 'normal' | 'high' | 'urgent' => {
  if (notifications.some(n => n.priority === 'urgent')) return 'urgent';
  if (notifications.some(n => n.priority === 'high')) return 'high';
  return 'normal';
};

interface NotificationBellProps {
  /** If true, renders as floating FAB. If false, renders as icon button for header */
  floating?: boolean;
}

export default function NotificationBell({ floating = true }: NotificationBellProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: notifications = [], isLoading } = useActiveNotifications();

  const unreadCount = notifications.length;
  const highestPriority = getHighestPriority(notifications);
  const priorityColor = getPriorityColor(highestPriority);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailModalOpen(true);
    handleClose();
  };

  const handleDetailClose = () => {
    setDetailModalOpen(false);
    setSelectedNotification(null);
  };

  const open = Boolean(anchorEl);

  // Don't render if no notifications and floating
  if (floating && unreadCount === 0 && !isLoading) {
    return null;
  }

  const bellButton = floating ? (
    <Fab
      onClick={handleClick}
      sx={{
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        width: 64,
        height: 64,
        bgcolor: `${priorityColor}.main`,
        color: 'white',
        boxShadow: 8,
        overflow: 'visible',
        '&:hover': {
          bgcolor: `${priorityColor}.dark`,
          transform: 'translateX(-50%) scale(1.05)',
        },
        transition: 'transform 0.2s ease-in-out',
      }}
    >
      <Badge
        badgeContent={unreadCount}
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            fontSize: '0.8rem',
            fontWeight: 'bold',
            minWidth: '24px',
            height: '24px',
            top: -8,
            right: -8,
            bgcolor: '#1a1a1a',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          },
        }}
      >
        <NotificationsIcon sx={{ fontSize: 28, color: 'white' }} />
      </Badge>
    </Fab>
  ) : (
    <IconButton
      color="inherit"
      onClick={handleClick}
      sx={{
        '&:hover': {
          backgroundColor: alpha('#fff', 0.1),
        },
      }}
    >
      <Badge
        badgeContent={unreadCount}
        color="error"
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            fontSize: '0.7rem',
            fontWeight: 'bold',
          },
        }}
      >
        <NotificationsIcon />
      </Badge>
    </IconButton>
  );

  return (
    <>
      {bellButton}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: 480,
              mt: 1,
              borderRadius: 2,
              boxShadow: 8,
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'primary.main',
            color: 'white',
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} active`}
              size="small"
              sx={{
                bgcolor: alpha('#fff', 0.2),
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          )}
        </Box>

        {/* Loading State */}
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography color="text.secondary">
              All caught up! No active notifications.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 380, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.notification_id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 1.5,
                    px: 2,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    borderLeft: 4,
                    borderColor: `${getPriorityColor(notification.priority)}.main`,
                  }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getPriorityIcon(notification.priority)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          component="span"
                          variant="body2"
                          fontWeight="bold"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {notification.title}
                        </Typography>
                        {notification.priority === 'urgent' && (
                          <Chip
                            label="URGENT"
                            size="small"
                            color="error"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                          }}
                        >
                          {notification.lead?.first_name} {notification.lead?.last_name}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Popover>

      {/* Detail Modal */}
      <NotificationDetailModal
        open={detailModalOpen}
        onClose={handleDetailClose}
        notification={selectedNotification}
      />
    </>
  );
}
