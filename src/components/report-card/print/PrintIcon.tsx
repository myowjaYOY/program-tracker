'use client';

import React from 'react';
import { SxProps, Theme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { getUiIcon, getMsqDomainIcon, getPromisDomainIcon } from '@/lib/utils/pdf-icons';

interface PrintIconProps {
    type: 'ui' | 'msq' | 'promis';
    name: string;
    size?: number;
    color?: string;
    sx?: SxProps<Theme>;
}

/**
 * Styled span that supports the sx prop.
 * Using a <span> instead of MUI <Box> to avoid rendering a <div>,
 * which causes hydration errors when PrintIcon is nested inside
 * <Typography> (renders <p>). <span> is valid inline content inside <p>.
 */
const IconSpan = styled('span')({});

export default function PrintIcon({
    type,
    name,
    size = 20,
    color = 'currentColor',
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
        <IconSpan
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