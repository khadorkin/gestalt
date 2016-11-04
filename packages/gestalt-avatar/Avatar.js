// @flow
import React, { PropTypes } from 'react';
import classnames from 'classnames/bind';
import Image from 'gestalt-image';
import Mask from 'gestalt-mask';
import styles from './Avatar.css';

const cx = classnames.bind(styles);

type DefaultAvatarProps = {
  name: string,
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
};

function DefaultAvatar(props: DefaultAvatarProps) {
  const { name, size } = props;
  // $FlowIssue: String spread.
  const firstInitial = [...name][0].toUpperCase();
  const classes = cx(size, 'defaultAvatar');

  const noImageClasses = cx(
    'bold',
    'antialiased',
    `initial-${size}`,
    'white',
  );

  return (
    <div aria-label={name} className={classes}>
      <div className={noImageClasses}>{firstInitial}</div>
    </div>
  );
}

export { DefaultAvatar };

type AvatarProps = {
  name: string,
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
  src?: string,
}

export default function Avatar(props: AvatarProps) {
  const {
    name,
    size,
    src,
  } = props;

  if (!src) {
    return (
      <div className={cx(size)}>
        <DefaultAvatar name={name} size={size} />
      </div>
    );
  }

  const classes = cx(size);

  return (
    <div className={classes}>
      <Mask shape="circle">
        <Image
          alt={name}
          color={'#efefef'}
          height={1}
          src={src}
          wash
          width={1}
        />
      </Mask>
    </div>
  );
}

Avatar.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']).isRequired,
  src: PropTypes.string,
};
