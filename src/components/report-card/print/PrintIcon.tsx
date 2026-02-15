'use client';

import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { getUiIcon, getMsqDomainIcon, getPromisDomainIcon } from '@/lib/utils/pdf-icons';

interface PrintIconProps {
    type: 'ui' | 'msq' | 'promis';
    name: string;
    size?: number;
    color?: string;
    sx?: SxProps<Theme>;
}

export default function PrintIcon({
    type,
    name,
    size = 20,
    color = 'currentColor', // Default color
    sx
}: PrintIconProps) {
    let iconHtml = '';

    const options = { size, color };

    if (type === 'ui') {
        iconHtml = getUiIcon(name, options);
    } else if (type === 'msq') {
        iconHtml = getMsqDomainIcon(name, options);
    } else if (type === 'promis') {
        iconHtml = getPromisDomainIcon(name, options);
    }

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
                ...sx
            }}
            dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
    );
}
