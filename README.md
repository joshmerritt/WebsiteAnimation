## WebsiteAnimation

#### Overview
    My aim is to create an interactive personal website to display my portfolio and development skills.
    Each "project" has an image and an about file with details. When an image is hovered over, the user is
    prompted to "aim," if they click and drag they can launch the "ball" towards the "goal" which is actually the menu.
    If the ball goes through the goal, the selected project is loaded full screen. 

#### Requirements
    - Accepts 1 or more images to display as thumbnails/balls
    - Shows direction and power arrow when user hovers over thumbnail
    - Allows for user to "launch" the thumbnail by clicking on it
    - Releasing the mouse sends the thumbnail in the applicable direction
    - A "goal" is created by the menu
    - A successful attempt will result in the applicable thumbnail launching it's info page
    - The thumbnail will only load the page if it passes through the goal posts
    - An invisible barrier will surround the menu/goal in order to only allow access through the goalposts
    - Each thumbnail will have an information page
    - Each subcategory for the menu will be clickable
    - The names of the subcategories should be ordered in descending length
    - The playfield should adjust to screensize
    - There should be an about footer
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
    - Build display page to appear like the imageball is simply expanded to allow for full view of the page (aka transform the ball from current position to center of page positon)
    - Add in reset button to main page
    - Add in close button to detail page
    - Add footer
    - Need to fix arrow rotation