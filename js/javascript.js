$(document).ready(function() {

  $('#descriptionBody').fadeIn(1000);
  $('#contactBody').css('display', 'none');

  $('#workEx1').css('display', 'none');
  $('#workEx2').css('display', 'none');


  //Click Me
  $('#description').click(function() {
    event.preventDefault();
    $('#contactBody').hide();
    $('#descriptionBody').fadeIn(1000);

    $(this).addClass('active');
    $('#contact').removeClass('active');
  });

  //Click Contact
  $('#contact').click(function() {
    event.preventDefault();
    $('#descriptionBody').hide();
    $('#contactBody').fadeIn(1000);

    $('#description').removeClass('active');
    $(this).addClass('active');
  });


});
