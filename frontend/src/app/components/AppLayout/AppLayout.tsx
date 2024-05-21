import imgAvatar from '@app/assets/bgimages/avatar-user.svg';
import logo from '@app/assets/bgimages/Logo-Red_Hat-OpenShift_AI-A-Reverse-RGB.svg';
import { IAppRoute, IAppRouteGroup, routes } from '@app/routes';
import {
  Avatar,
  Brand,
  Button,
  ButtonVariant,
  FormSelect,
  FormSelectOption,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavExpandable,
  NavItem,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  Popover,
  Select,
  SelectOption,
  SkipToContent,
  Text,
  TextContent,
  TextVariants,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { BarsIcon, QuestionCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportedLngs } from '../../../i18n/config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLanguage } from '@fortawesome/free-solid-svg-icons';

interface IAppLayout {
  children: React.ReactNode;
}

const AppLayout: React.FunctionComponent<IAppLayout> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [selectedLanguage, setSelectedLanguage] = React.useState('en');

  const onChangeLanguage = (_event: React.FormEvent<HTMLSelectElement>, language: string) => {
    setSelectedLanguage(language);
    i18n.changeLanguage(language);
  };

  //i18n
  const { t, i18n } = useTranslation();
  React.useEffect(() => {
    i18n.changeLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const headerToolbar = (
    <Toolbar id="toolbar" isFullHeight isStatic>
      <ToolbarContent>
        <ToolbarGroup
          variant="icon-button-group"
          align={{ default: 'alignRight' }}
          spacer={{ default: 'spacerMd', md: 'spacerMd' }}
        >
          <ToolbarItem>
            <Popover
              aria-label="Help"
              position="right"
              headerContent={t('app_header.help.header')}
              bodyContent={t('app_header.help.body')}
              footerContent={t('app_header.help.footer')}
            >
              <Button aria-label="Help" variant={ButtonVariant.plain} icon={<QuestionCircleIcon />} />
            </Popover>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const Header = (
    <Masthead>
      <MastheadToggle>
        <Button variant="plain" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Global navigation">
          <BarsIcon />
        </Button>
      </MastheadToggle>
      <MastheadMain>
        <MastheadBrand>
          <TextContent>
            <Text component={TextVariants.h3} className='title-text'>{t('app_header.powered_by')}</Text>
          </TextContent>
          <Brand src={logo} alt="Patternfly Logo" heights={{ default: '36px' }} />
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        {headerToolbar}
      </MastheadContent>
    </Masthead>
  );

  const location = useLocation();


  const renderNavItem = (route: IAppRoute, index: number) => (
    <NavItem key={`${route.label}-${index}`} id={`${route.label}-${index}`} isActive={route.path === location.pathname} className='navitem-flex'>
      <NavLink exact={route.exact} to={route.path} className={route.path !== '#' ? '' : 'disabled-link'}>
        {t(route.label as string)}
      </NavLink>
    </NavItem>
  );

  const renderNavGroup = (group: IAppRouteGroup, groupIndex: number) => (
    <NavExpandable
      key={`${group.label}-${groupIndex}`}
      id={`${group.label}-${groupIndex}`}
      title={group.label}
      isActive={group.routes.some((route) => route.path === location.pathname)}
    >
      {group.routes.map((route, idx) => route.label && renderNavItem(route, idx))}
    </NavExpandable>
  );

  const Navigation = (
    <Nav id="nav-first-simple" theme="dark">
      <NavList id="nav-list-first-simple">
        {routes.map(
          (route, idx) => route.label && (!route.routes ? renderNavItem(route, idx) : renderNavGroup(route, idx))
        )}
      </NavList>
    </Nav>
  );

  const Sidebar = (
    <PageSidebar theme="dark" >
      <PageSidebarBody isFilled>
        {Navigation}
      </PageSidebarBody>
    </PageSidebar>
  );

  const pageId = 'primary-app-container';

  const PageSkipToContent = (
    <SkipToContent onClick={(event) => {
      event.preventDefault();
      const primaryContentContainer = document.getElementById(pageId);
      primaryContentContainer && primaryContentContainer.focus();
    }} href={`#${pageId}`}>
      Skip to Content
    </SkipToContent>
  );
  return (
    <Page
      mainContainerId={pageId}
      header={Header}
      sidebar={sidebarOpen && Sidebar}
      skipToContent={PageSkipToContent}>
      {children}
    </Page>
  );
};

export { AppLayout };
