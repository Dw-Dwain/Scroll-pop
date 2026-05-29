<?php
/**
 * Plugin Name: ScrollPop
 * Plugin URI:  https://scrollpop.online
 * Description: Google-compliant scroll-triggered popup campaigns for affiliate marketing, lead generation, and donations.
 * Version:     1.0.0
 * Author:      ScrollPop
 * Author URI:  https://scrollpop.online
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: scrollpop
 * Domain Path: /languages
 *
 * This plugin injects the ScrollPop snippet into wp_head.
 * All popup logic runs in the cloud — this plugin just connects your site.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

define( 'SCROLLPOP_VERSION', '1.0.0' );
define( 'SCROLLPOP_PLUGIN_FILE', __FILE__ );
define( 'SCROLLPOP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SCROLLPOP_CDN_URL', 'https://cdn.scrollpop.online' );

require_once SCROLLPOP_PLUGIN_DIR . 'includes/class-scrollpop.php';
require_once SCROLLPOP_PLUGIN_DIR . 'includes/class-admin.php';
require_once SCROLLPOP_PLUGIN_DIR . 'includes/class-snippet.php';

/**
 * Main plugin instance
 */
function scrollpop(): ScrollPop {
    return ScrollPop::instance();
}

scrollpop();
