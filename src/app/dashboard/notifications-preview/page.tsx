'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  alpha,
  Fab,
  Badge,
  Popover,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Notifications as NotificationsIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { NotificationDetailModal } from '@/components/notifications';
import type { Notification } from '@/components/notifications';
import { formatDistanceToNow } from 'date-fns';

// Mock notifications for preview - matches Notification type from use-notifications.ts
const mockNotifications: Notification[] = [
  {
    notification_id: 1,
    lead_id: 42,
    priority: 'urgent',
    title: 'Negative Survey Response',
    message:
      'John Smith submitted a survey with negative feedback on their treatment experience. Patient reported dissatisfaction with wait times and communication. Immediate follow-up recommended.',
    source_note_id: null,
    target_role_ids: [1],
    target_role_names: ['Manager'],
    status: 'active',
    acknowledged_at: null,
    acknowledged_by: null,
    response_note_id: null,
    created_by: 'system',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    lead: { lead_id: 42, first_name: 'John', last_name: 'Smith' },
  },
  {
    notification_id: 2,
    lead_id: 156,
    priority: 'high',
    title: 'Member Requires Attention',
    message:
      'Jane Doe has missed 3 consecutive appointments. Provider intervention may be needed to re-engage the member.',
    source_note_id: null,
    target_role_ids: [2],
    target_role_names: ['Provider'],
    status: 'active',
    acknowledged_at: null,
    acknowledged_by: null,
    response_note_id: null,
    created_by: 'system',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
    lead: { lead_id: 156, first_name: 'Jane', last_name: 'Doe' },
  },
  {
    notification_id: 3,
    lead_id: 89,
    priority: 'normal',
    title: 'New Lead Assigned',
    message:
      'A new lead from the Spring Campaign has been assigned to your region. Please review and schedule initial contact.',
    source_note_id: null,
    target_role_ids: [3],
    target_role_names: ['Coordinator'],
    status: 'active',
    acknowledged_at: null,
    acknowledged_by: null,
    response_note_id: null,
    created_by: 'system',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    lead: { lead_id: 89, first_name: 'New', last_name: 'Lead' },
  },
  {
    notification_id: 4,
    lead_id: 78,
    priority: 'normal',
    title: 'Positive Survey Response',
    message:
      'Robert Johnson left a 5-star review praising the program. Consider requesting a testimonial.',
    source_note_id: null,
    target_role_ids: [1],
    target_role_names: ['Manager'],
    status: 'acknowledged',
    acknowledged_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledged_by: 'user-123',
    response_note_id: null,
    created_by: 'system',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    lead: { lead_id: 78, first_name: 'Robert', last_name: 'Johnson' },
    acknowledger: { id: 'user-123', full_name: 'Sarah Manager', email: 'sarah@example.com' },
  },
];

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

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    default:
      return 'info';
  }
};

export default function NotificationsPreviewPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fabAnchorEl, setFabAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setModalOpen(true);
    setFabAnchorEl(null);
  };

  const handleAcknowledge = (notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === notification.notification_id
          ? {
              ...n,
              status: 'acknowledged' as const,
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: 'current-user',
              acknowledger: { id: 'current-user', full_name: 'Current User', email: 'user@example.com' },
            }
          : n
      )
    );
  };

  const activeNotifications = notifications.filter((n) => n.status === 'active');
  const acknowledgedNotifications = notifications.filter((n) => n.status === 'acknowledged');

  const fabOpen = Boolean(fabAnchorEl);

  // Determine the most severe priority for FAB color
  const getMostSeverePriority = () => {
    if (activeNotifications.some((n) => n.priority === 'urgent')) return 'urgent';
    if (activeNotifications.some((n) => n.priority === 'high')) return 'high';
    return 'normal';
  };

  const mostSeverePriority = getMostSeverePriority();

  const getFabColor = () => {
    switch (mostSeverePriority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* FLOATING ACTION BUTTON - Fixed Position, Hidden when no notifications */}
      {activeNotifications.length > 0 && (
        <Fab
          color={getFabColor()}
          onClick={(e) => setFabAnchorEl(e.currentTarget)}
        sx={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          width: 64,
          height: 64,
          boxShadow: (theme) => theme.shadows[8],
          '&:hover': {
            transform: 'translateX(-50%) scale(1.05)',
          },
          transition: 'transform 0.2s ease-in-out',
        }}
      >
        <Badge
          badgeContent={activeNotifications.length}
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
      )}

      {/* Floating Panel Popover */}
      <Popover
        open={fabOpen}
        anchorEl={fabAnchorEl}
        onClose={() => setFabAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: 480,
              mt: 1,
              borderRadius: 2,
              boxShadow: (theme) => theme.shadows[12],
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Panel Header */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            Notifications
          </Typography>
          {activeNotifications.length > 0 && (
            <Chip
              label={`${activeNotifications.length} active`}
              size="small"
              sx={{
                bgcolor: alpha('#fff', 0.2),
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          )}
        </Box>

        {/* Notification List */}
        {activeNotifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography color="text.secondary">
              All caught up! No active notifications.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 340, overflow: 'auto' }}>
            {activeNotifications.map((notification, index) => (
              <React.Fragment key={notification.notification_id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 1.5,
                    px: 2,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
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
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Footer */}
        {activeNotifications.length > 0 && (
          <Box
            sx={{
              p: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => {
                setFabAnchorEl(null);
                alert('Navigate to full notifications page');
              }}
              sx={{ fontWeight: 'bold' }}
            >
              View All Notifications
            </Button>
          </Box>
        )}
      </Popover>

      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main">
          Notification System Preview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Click the floating button in the bottom-right corner to see notifications
        </Typography>
      </Box>

      <Grid container spacing={3}>

        {/* Floating Button Info */}
        <Grid size={12}>
          <Card sx={{ bgcolor: alpha('#8e24ff', 0.05), border: 2, borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ mb: 1 }}>
                👉 Floating Notification Button
              </Typography>
              <Typography variant="body1">
                Look at the <strong>bottom-right corner</strong> of this page. You&apos;ll see a purple floating button with a notification count badge. Click it to open the notification panel.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Notifications */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Active Notifications
                </Typography>
                <Chip
                  label={activeNotifications.length}
                  color="error"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click any notification to see the detail modal
              </Typography>

              <List sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                {activeNotifications.map((notification, index) => (
                  <React.Fragment key={notification.notification_id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        borderLeft: 4,
                        borderColor: `${getPriorityColor(notification.priority)}.main`,
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <ListItemIcon>{getPriorityIcon(notification.priority)}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {notification.title}
                            {notification.priority === 'urgent' && (
                              <Chip
                                label="URGENT"
                                size="small"
                                color="error"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={`${notification.target_role_names?.[0] ?? 'Unknown'} role`}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Acknowledged Notifications */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Acknowledged Notifications
                </Typography>
                <Chip
                  label={acknowledgedNotifications.length}
                  color="success"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Shows who took responsibility
              </Typography>

              <List sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                {acknowledgedNotifications.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No acknowledged notifications yet"
                      secondary="Click an active notification and acknowledge it to see it here"
                    />
                  </ListItem>
                ) : (
                  acknowledgedNotifications.map((notification, index) => (
                    <React.Fragment key={notification.notification_id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          opacity: 0.8,
                        }}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <ListItemIcon>
                          <CheckCircleIcon color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={notification.title}
                          secondary={`Acknowledged by ${notification.acknowledger?.full_name ?? 'Unknown'}`}
                        />
                      </ListItem>
                    </React.Fragment>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Priority Legend */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Priority Levels
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ErrorIcon color="error" />
                  <Typography variant="body2">
                    <strong>Urgent</strong> - Immediate action required
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="warning" />
                  <Typography variant="body2">
                    <strong>High</strong> - Requires attention soon
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon color="info" />
                  <Typography variant="body2">
                    <strong>Normal</strong> - Informational
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Implementation Notes */}
        <Grid size={12}>
          <Card sx={{ bgcolor: alpha('#8e24ff', 0.05), border: 1, borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ mb: 2 }}>
                Implementation Notes
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                <li>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Floating Button:</strong> Fixed position FAB in bottom-right corner of the app
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Polling:</strong> Use React Query with 30-second refetch interval
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Role-based:</strong> API filters notifications by current user&apos;s role
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Acknowledgment:</strong> One person acknowledges → clears for all in that role
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Click-through:</strong> Navigate to related entity (lead, member, program)
                  </Typography>
                </li>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detail Modal */}
      <NotificationDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        notification={selectedNotification}
      />
    </Box>
  );
}

