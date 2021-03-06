## Portfolio Website by Josh Merritt

### Overview

My aim is to create an interactive personal website to display my portfolio and development skills.
Each "project" has an image and an about file with details. When an image is hovered over, the user is
prompted to "aim," if they click and drag they can launch the "ball" towards the "goal" which is actually the menu.
If the ball goes through the goal, the selected project is loaded full screen.

#### Technology

JavaScript, CSS3, HTML5, Git, cPanel. I used a visualization library based upon the respected Processing.org, called p5.js, 
along with a simple physics engine, matter.js. Both libraries are open-source and were easily accessible to an amatuer developer. 

### Creating your own website

If you are interested in using my code to run your website, you'll need to:

    - Clone this repository
    - Update the sketch.js file to set your desired project display order
    - Create your description files for each project (see template)
    - Add your image and text files
    - Host on a server of your choosing (I use cpanel linked to github for automated deployment)
    - Send prospective employers and colleagues your site to show off your skills

## Project Plan

#### Requirements

    - Accepts 1 or more images to display as thumbnails/balls
    - Scales responsively based upon screen size and the number of projects
    - Shows direction and power arrow when user hovers over thumbnail
    - Allows for user to "launch" the thumbnail by clicking on it
    - Releasing the mouse sends the thumbnail in the applicable direction
    - A "goal" is created by the menu
    - A successful attempt will result in the applicable thumbnail launching it's info page
    - The thumbnail will only load the page if it passes through the goal posts
    - An invisible barrier will surround the menu/goal in order to only allow access through the goalposts
    - Each thumbnail will have an information page
    - Categories will be dynamically derived from the project text files
    - Each category for the menu will be clickable
    - The names of the subcategories should be ordered in descending length
    - The playfield should always fill the screen
    - There should be a title
    - There should be an about footer, with links to contact
    - Info pages should contain images, descriptions, and/or links
    - There should be a boundary outside the playfield to deflect the ball back
    - The thumbnail resets to it's position if it remains offscreen

##### Collision Rules
    - All balls will collide with the boundary.
    - All balls will collide with other balls
    - All balls will collide with the goal posts
    - All balls will collide with the invisible boundaries
    - Balls will only collide with the menu category that matches their own category

###### In progress notes
    X Add text descriptions of images
    X Add categories to array
    X Add menu item for each category
    X Add invisible rectangle for each menu item
    X Add in collision filtering so ball bounces on applicable menu item when made
    X Add invisible side bars to prevent reaching menu other than through goal
    X Refactor HTML elements to be added when they are displayed, rather than having multiple elements hidden
    X Add in close button
    X Disable launching when detail page is open
    X Add in reset button
    X When detail page is closed, reset all balls
    X Add doubleclick to allow for opening of item
    X Add configuration object
    X Refactor Reset logic
    X Test side wall permeability
    X Add a mimic'd version of the website as the first ball
    X Add title
    X Add footer with contact links
    X Add invisible box around contact link to have balls bounce off
    X Add thin border to balls, only have thick border for 'Portfolio Website' ball
    X Need to fix arrow rotation
    X Implement round png images for balls to remove thick border effect
    X Fix detail page image to be original and square
    X Improve title responsiveness
    X Rework screen size function to resize everything
    X Make sure refresh button is centered
    X Styling with CSS
    X Implement detail page opening
    X Remove old masks when resizing
    X Improve "launch" sensitivity based upon screen size
    X Resize contact us div to be 2/3rds of screen
    X Add Josh tile with headshot and about me blurb
    X Improve descriptions to include: role/contribution, technology used (languages, hardward, aka tech stack)
    X Refactor detail page sizing and position logic
    X Reset image on detail page when screen resized, or if not Close detail page
    X Lower restitution on menu bars, make less bouncy
    X Make detail page title it's own h1/2 element
    X Add double click ability to menu, display applicable subset of balls
    X Prompt that double clicking is okay
    X Fix iphone support for double click, add in timestamp to mouse released
    _ Add loading screen that is actually button that says start
    X Create new site named: dadatadad.com, joshalytics.com, numbersaurusrex.com, joshuapaulmerritt.com, modernmetricmonk.com, dataproblemsolving.com

Secondary tasks
    _ Reorg codebase and complete documentation
    X Test slanted net
    _ Add some visual of the stats for number of shots and number made, % of projects opened
    _ Build display page to appear like the imageball is simply expanded to allow for full view of the page
    _ Add some special effect when a ball is made
    X Troubleshoot simultaneous collision issues
    